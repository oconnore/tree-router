'use strict';

var priv = new WeakMap();

var rMap = Map;
var rSet = Set;

function concatD(list, args) {
  for (var i = 1; i < arguments.length; i++) {
    var nlist = arguments[i];
    Array.prototype.push.apply(list, nlist);
  }
  return list;
};

// A doubly linked node
function Node(value, prev, next) {
  this.value = value;
  this.prev = prev;
  this.next = next;
}

// A Sequence is a doubly linked list where the conses
// are also stored in a Map and accessible by a key.
function Sequence(iterable) {
  this.sequence = null;
  this._size = 0;
  this.nodeMap = new rMap();
  if (iterable) {
    if (typeof iterable.length === 'number') {
      for (var i = 0; i < iterable.length; i++) {
        this.add.apply(this, iterable[i]);
      }
    } else if (typeof iterable.iterator === 'function') {
      var it = iterable.iterator();
      while (!it.done) {
        this.add.apply(this, it.next());
      }
    }
  }
}
Sequence.prototype = {
  constructor: Sequence,
  clear: function clear() {
    this.sequence = null;
    this._size = 0;
    this.nodeMap = new rMap();
  },
  get size() {
    return this._size;
  },
  add: function set(key, value) {
    if (!this.nodeMap.has(key)) {
      var node = new Node([key, value], null, this.sequence);
      if (this.sequence) {
        this.sequence.prev = node;
      }
      this.sequence = node;
      this.nodeMap.set(key, node);
      this._size++;
    } else {
      var node = this.nodeMap.get(key);
      node.value = [key, value];
    }
  },
  has: function has(key) {
    return this.nodeMap.has(key);
  },
  get: function get(key) {
    if (this.nodeMap.has(key)) {
      return this.nodeMap.get(key).value[1];
    }
  },
  delete: function _delete(key) {
    if (this.nodeMap.has(key)) {
      var node = this.nodeMap.get(key);
      var prev = node.prev, next = node.next;
      if (prev) {
        prev.next = next;
      }
      if (next) {
        next.prev = prev;
      }
      this.sequence = next || prev;
      this.nodeMap.delete(key);
      this._size--;
      return true;
    }
    return false;
  },
  iterator: function iterator() {
    var cur = this.sequence;
    var iterator = {};
    Object.defineProperty(iterator, 'done', {
      get: function() {
        return !cur;
      }
    });
    iterator.next = (function next() {
      if (!this.done && cur) {
        var tmp = cur;
        cur = cur.next;
        return tmp.value;
      } else {
        this.done = true;
      }
    }).bind(iterator);
    return iterator;
  },
  forEach: function(caller, cb, thisArg) {
    // Map a Function `cb` over the entries
    if (typeof cb === 'function') {
      var iter = this.iterator();
      while (!iter.done) {
        var i = iter.next();
        cb.call(thisArg, i[1], i[0], caller);
      }
    }
  }
};

// bindHelper calls a function on our private internal Sequence.
// It is used by EnumMap and EnumSet to delegate to the private
// sequence object.
function bindHelper(fn) {
  return function() {
    var p = priv.get(this);
    return fn.apply(p.sequence, Array.prototype.slice.call(arguments));
  }
}

// This is our poly-filled Map, which we can enumerate using Sequence
function EnumMap(iter) {
  var p = {};
  priv.set(this, p);
  p.sequence = new Sequence(iter);
}
EnumMap.prototype = {
  constructor: EnumMap,
  get size() {
    var p = priv.get(this);
    return p.sequence.size;
  },
  has: bindHelper(Sequence.prototype.has),
  get: bindHelper(Sequence.prototype.get),
  delete: bindHelper(Sequence.prototype.delete),
  clear: bindHelper(Sequence.prototype.clear),
  set: bindHelper(Sequence.prototype.add),
  iterator: bindHelper(Sequence.prototype.iterator),
  forEach: function() {
    var p = priv.get(this);
    Sequence.prototype.forEach.apply(p.sequence,
      concatD([this], arguments));
  }
}

// This is our poly-filled Set, which we can enumerate using Sequence
function EnumSet(iter) {
  var p = {};
  priv.set(this, p);
  p.sequence = new Sequence(iter);
}
EnumSet.prototype = {
  constructor: EnumSet,
  get size() {
    var p = priv.get(this);
    return p.sequence.size;
  },
  has: bindHelper(Sequence.prototype.has),
  get: bindHelper(Sequence.prototype.get),
  delete: bindHelper(Sequence.prototype.delete),
  clear: bindHelper(Sequence.prototype.clear),
  add: (function() {
    var helper = bindHelper(Sequence.prototype.add);
    return function add(value) {
      helper.call(this, value, value);
    };
  })(),
  iterator: bindHelper(Sequence.prototype.iterator),
  forEach: function() {
    var p = priv.get(this);
    Sequence.prototype.forEach.apply(p.sequence,
      concatD([this], arguments));
  }
}

exports.Map = EnumMap;
exports.Set = EnumSet;
