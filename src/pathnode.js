'use strict';

var col = require('harmony-enumerables');
var eMap = col.Map;
var eSet = col.Set;

var _ = require('lodash');
var utils = require('./utils');


// A PathNode is used to represent a node in this server's HTTP call
// tree. Instead of relying on regular expressions, we use an explicit
// tree of nodes, and then traverse it on incoming connections. This
// mostly just gains us the ability to reason about hierarchy. For
// example, error handlers and authentication checks are guaranteed
// to apply to everything in the sub tree.
//
// Also, even people who are very good at regular expressions (and
// understand that they are basically doing the same sort of state
// traversal implemented here!) can probably agree that they are
// not human friendly.
function PathNode(opts) {
  opts = opts || {};
  // method name // 'all' -> request handler
  this.handlers = opts.handlers || new eMap();
  // method name // `all` -> gate predicate (can I pass?)
  this.gates = opts.gates || new eMap();
  // method name // `all` -> error handler
  this.errors = opts.errors || new eMap();
  // parent node
  this.parent = opts.parent || null;
  // child path name -> PathNode
  this.children = opts.children || new eMap();
}

// This function is used to turn an HTTP path into a list of node
// names.
PathNode.split = function(p) {
  if (typeof p === 'string') {
    p = p.split(/\/+/);
  }
  _.remove(p, function(x) {
    return typeof x !== 'string' || x === '';
  });
  return p;
};

// StopIteration is thrown to end PathNode traversals and walks
PathNode.StopIteration = function StopIteration() {};
PathNode.StopIteration.prototype.__proto__ = Error.prototype;

PathNode.prototype = {
  constructor: PathNode,
  getChildNames: function() {
    // Get a list of child node names.
    // This is mostly used for debugging.
    var ret = [];
    var iter = this.children.iterator();
    while (!iter.done()) {
      ret.push(iter.next()[0]);
    }
    return ret;
  },
  traversePath: function(p, nodeCallback) {
    // Traverse the tree based on the supplied path `p`, calling the
    // `nodeCallback` on each node along the way. The `nodeCallback`
    // is passed three arguments, the node, the name, and the depth.
    // The traversal includes the root node, named 'ROOT'.
    // If nodeCallback throws a StopIteration, the traversal halts.
    p = PathNode.split(p);
    var cur = this, n = 'ROOT', count = 0;
    for (var i = 0; i <= p.length; i++) {
      try {
        nodeCallback.call(cur, cur, n, i);
      } catch (err) {
        if (!(err instanceof PathNode.StopIteration)) {
          throw err;
        } else {
          break;
        }
      } finally {
        count++;
      }
      if (i < p.length) {
        n = p[i];
        if (cur.children.has(n)) {
          cur = cur.children.get(n);
        } else {
          break;
        }
      }
    }
    return count;
  },
  lookup: function(pth) {
    // Perform a basic lookup on the node tree, based on a supplied path.
    // Finds the closest matching node, and then returns an object containing
    // that `node`, the closest existing `path`, and the `unused` elements of
    // the supplied path.
    // For example, if I search for [a, b, c, d], and my tree only contains
    // a node at [a, b], I will receive:
    // {node: #<b node>, path: [a, b], unused: [c, d]}
    var ret = {
      node: null,
      path: [],
      unused: []
    };
    var i = -1; // skip root node in collection, root = []
    this.traversePath(pth, function(node, name) {
      ret.node = node;
      if (i >= 0) {
        ret.path.push(name);
      }
      i++;
    });
    if (i !== pth.length) {
      ret.unused = pth.slice(i);
    }
    return ret;
  },
  bubble: function(fn) {
    // Once we have found a node, we often want to 'bubble' up towards
    // the root. This calls fn on itself, and then on each successive
    // higher node in the hierarchy, until we reach the root, or the
    // `fn` throws a StopIteration.
    var cur = this;
    while (cur && cur.parent) {
      try {
        fn.call(null, cur);
        cur = cur.parent;
      } catch (err) {
        if (!(err instanceof PathNode.StopIteration)) {
          throw err;
        } else {
          break;
        }
      }
    }
  },
  ensure: function(p) {
    // Used to guarantee that a node at a certain path exists. Creating
    // a node is usually accompanied by adding a handler/error/gate,
    // because otherwise the node will be quickly garbage collected.
    p = PathNode.split(p);
    var cur = this;
    for (var i = 0; i < p.length; i++) {
      var n = p[i];
      var ls = [];
      cur.children.forEach(function(val, key) {
        ls.push(key);
      });
      if (!cur.children.has(n)) {
        var tmp = new PathNode();
        tmp.parent = cur;
        cur.children.set(n, tmp);
        cur = tmp;
      } else {
        cur = cur.children.get(n);
      }
    }
    return cur;
  },
  gc: function() {
    // Removes unused nodes in the tree. An unused node is something
    // without a handler, gate, or error handler.
    // The arguments to gc are used for recursion, so just call with
    // no arguments.
    var mark = arguments[0] || new eSet();
    var keepself = false;
    var deleteQueue = [];
    var iter = this.children.iterator();
    while (!iter.done) {
      var ch = iter.next();
      var keep = ch[1].gc(mark);
      if (ch[1].handlers.size === 0 &&
          ch[1].gates.size === 0 &&
          ch[1].errors.size === 0 &&
          !keep) {
        this.children.delete(ch[0]);
      } else {
        keepself = true;
      }
    }
    return keepself;
  },
  add: function(type, pth, method, callback) {
    // Add something to a node at the supplied path `pth`. The type is one
    // of 'handlers', 'errors', or 'gates'. The `method` is the HTTP
    // method, and the callback is the handler/error/gate function.
    var node = this.ensure(pth);
    node[type].set(method, callback);
  },
  remove: function(type, pth, method) {
    // Remove a handler/error/gate from the tree. The `type` is one
    // of 'handlers', 'errors', or 'gates', the `pth` is a path, and
    // the method is the http method.
    var removed, i = -1, cur = null;
    this.traversePath(pth, function(node, name) {
      cur = node;
      i++;
    });
    if (pth.length === i) {
      removed = cur[type].get(method);
      cur[type].delete(method);
      this.gc();
    }
    return removed;
  },
  walkTree: function(pre, post, recur) {
    // This performs a full traversal on the tree. The pre and post
    // arguments are expected to be functions which are evaluated
    // before or after we recurse to child nodes in the standard way.
    // `recur` is an object used for recursion, and should initially be
    // undefined.
    recur = recur || {
      name: 'ROOT',
      parent: null,
      level: 0
    };
    if (typeof pre === 'function') {
      pre.call(this, { name: recur.name, level: recur.level,
        parent: recur.parent, order: 'prefix' });
    }
    var iter = this.children.iterator();
    while (!iter.done) {
      var el = iter.next();
      this.walkTree.call(el[1], pre, post, {
        name: el[0], parent: this, level: recur.level + 1
      });
    }
    if (typeof post === 'function') {
      post.call(this, { name: recur.name, level: recur.level,
        parent: recur.parent, order: 'postfix' });
    }
  },
  printTree: function() {
    // For debugging purposes, this prints a string representation of
    // the tree. The string describes the methods that each node handles,
    // as well as whether or not a gate or error handler is defined for
    // each.
    var ret = [];
    this.walkTree(function(obj) {
      var desc = [];
      if (this.gates.size > 0) desc.push('G');
      if (this.errors.size > 0) desc.push('E');
      desc = desc.length > 0 ? (' [' + desc.join(',') + '] ') : ' ';
      var col = [utils.repeatString(' ', obj.level * 2), '', obj.name,
        desc, '-> '];
      this.handlers.forEach(function(x, k) {
        col.push(k);
      });
      ret.push(col.join(''));
    });
    return ret.join('\n');
  }
};

module.exports = PathNode;
