'use strict';

var http = require('http');
var url = require('url');
var _ = require('lodash');
var utils = require('./utils');
var EventEmitter = require('events').EventEmitter;

var PathNode = require('./pathnode');

var _r = require('./response');
var Bubble = _r.Bubble;
var Response = _r.Response;

var priv = new WeakMap();

var states = {
  init: 0,
  listening: 1,
  stopped: 2
};

// This is a wrapper around the Node.js http server. It uses PathNode's
// to route requests, errors, and perform authentication.
function Server(opts) {
  utils.initialize(this, priv, opts, {
    live: null,
    timeouts: {
      soft: 2500,
      hard: 25000
    },
    logErrors: false
  }, {
    state: states.init,
    hostname: '127.0.0.1',
    port: 8080,
    paths: new PathNode(),
    connections: new WeakMap()
  });
  EventEmitter.call(this);
}
Server.prototype = Object.create(EventEmitter.prototype);

Server.states = states;

// A special method object used in routing. Binding a handler, error, or
// gate to this method will allow that function to be called for any
// possible HTTP method. This makes it easy to define, for example,
// catch all errors, or universal authentication checks for GET/POST
// all in one function.
Server.AnyMethod = {};

Server.prototype.constructor = Server;

Server.prototype.start = function(done) {
  // Start the server asynchronously, and call `done` when it's
  // ready.
  var p = priv.get(this);
  var mk = function () {
    this.server = http.createServer(this.callback.bind(this));
    this.server.listen(p.port, p.hostname, function(err) {
      if (!err) {
        this.live = {
          ip: this.server.address().address,
          family: this.server.address().family,
          port: this.server.address().port
        };
        p.state = states.listening;
        this.setup();
      }
      this.emit('started');
      done && done.call(this, err);
    }.bind(this));
  }.bind(this);
  if (this.server) {
    this.server.close(mk);
  } else {
    mk();
  }
};

Server.prototype.setup = function(server) {
  this.bindTimeouts(server || this.server);
};

Server.prototype.bindTimeouts = function(server) {
  var p = priv.get(this);
  if (this.timeouts.soft > 0 || this.timeouts.hard > 0) {
    // When we get a connection, register timeouts
    server.on('connection', function(socket) {
      socket.setTimeout(this.timeouts.soft,
        this.httpTimeout.bind(this, socket));
      p.connections.set(socket, {
        start: Date.now(),
        timeout: setTimeout(this.httpTimeout.bind(this, socket),
          this.timeouts.hard)
      });
      socket.on('close', function() {
        clearTimeout(p.connections.get(this).timeout);
      });
    }.bind(this));
  }
};

Server.prototype.httpTimeout = function(socket) {
  var p = priv.get(this);
  var obj = p.connections.get(socket);
  if (obj) {
    socket.end();
    socket.destroy();
  }
};

Server.prototype.defaultError = function(req, res) {
  // This is the default error handler, called when the Server's router
  // errors, or has no other options for handling a thrown error. To
  // specify custom error behavior, define a catch all Server.AnyMethod
  // error handler on the ROOT path [].
  if (res.headersSent) {
    res.end();
    return;
  }
  var body = 'Unhandled error.';
  res.writeHead(500, body, {
    'Content-Length': body.length,
    'Reason': body
  });
  res.write(body);
  res.end();
};

function extendHttpReqRes(parsedUrl, splitpath, req, res) {
  // We extend the Node.js http.ServerRequest and http.ServerResponse
  // objects here.
  utils.extend(req, {
    nodePath: [],
    unused: splitpath.slice(),
    query: parsedUrl.query
  });

  res.__proto__ = Response.prototype;

  utils.extend(res, {
    error: null,
    privateError: null
  });
}

Server.prototype.handleError = function(error, stack, req, res) {
  // Takes an error, a stack of error handlers (lower indexes <- are closer
  // to the root node, higher indexes -> are close to the leaves), and the
  // request and response objects, and attempts to handle an error.
  // If the error handler function throws a Bubble error, we try the next
  // highest handler.
  var success = false;
  for (var i = stack.length - 1; !success && i >= 0; i--) {
    try {
      stack[i].call(this, req, res);
      success = true;
    } catch (err) {
      if (!(err instanceof Bubble)) {
        break;
      }
    }
  }
  if (!success) {
    throw error;
  }
};

Server.prototype.callback = function(req, res) {
  // Accepts a raw request and response from the inner http.HttpServer,
  // and performs all routing, authentication checks, and error handling.
  var p = priv.get(this);
  try {
    var errorStack = [];
    var handler = null, handlerIndex = -1;
    var u = url.parse(req.url, true);
    var splitpath = PathNode.split(u.pathname);
    extendHttpReqRes(u, splitpath, req, res);
    // We traverse the tree, looking for the supplied path.
    // `count` is the depth that we were able to traverse.
    var count = p.paths.traversePath(splitpath, function(node, name, depth) {
      // depth === 0 is the root, and we're not interested in the root's name
      if (depth > 0) {
        req.nodePath.push(name);
        req.unused.shift(1);
      }
      // The error stack is built incrementally as we traverse down the tree.
      utils.concatD(errorStack, utils.truthy(
        node.errors.get(Server.AnyMethod),
        node.errors.get(req.method)
      ));
      // If we find a gate along the way, the gate function must not throw
      // an error when called.
      utils.truthy(
        node.gates.get(Server.AnyMethod),
        node.gates.get(req.method)
      ).forEach(function(gate) {
        try {
          gate.call(this, req, res);
        } catch (err) {
          // Set the handler to null to prevent a previously discovered
          // handler from being called. (Javascript doesn't have a
          // return-from).
          handler = null;
          // The gate may bind the error to the reponse. This error may be
          // shared with the client, so the gate should be careful not to
          // expose sensitive information here.
          res.error = res.error || new Error('Gate closed.');
          // In some cases, the real reason for the error is sensitive, or
          // may contain information that we don't want to divulge to the
          // client. The privateError property stores the real error.
          res.privateError = err;
          // Initiate error handling
          this.handleError(err, errorStack, req, res);
          // If we're here, we just handled an error, and no longer want
          // to traverse the tree, so stop.
          throw new PathNode.StopIteration();
        }
      }.bind(this));
      // If we have a matching handler available, bind it to handler, and
      // keep track of how much path we have consumed in `handlerIndex`.
      var _handler = _.last(utils.truthy(
        node.handlers.get(Server.AnyMethod),
        node.handlers.get(req.method)));
      if (typeof _handler === 'function') {
        handler = _handler;
        handlerIndex = depth;
      }
    }.bind(this));
    try {
      if (!handler) {
        res.error = res.privateError = new Error('Invalid Path');
        throw res.error;
      }
      // Set the request `nodePath` and `unused` properties to the
      // appropriate values.
      req.nodePath = splitpath.slice(0, Math.max(handlerIndex, 0));
      req.unused = splitpath.slice(Math.max(handlerIndex, 0));

      handler.call(this, req, res);
      if (res.error) {
        throw res.error;
      }
    } catch (err) {
      // The handler errored, set the error and privateError as before.
      // res.error is the publicly acknowledged error.
      // res.privateError is the real error (which could === res.error).
      res.error = res.error || new Error('Unknown error.');
      req.privateError = err;
      this.handleError(err, errorStack, req, res);
    }
  } catch (err) {
    // Some part of the routing stack errored, or there is no error handler
    // for the error that was thrown. Log the error, and call the
    // defaultError handler.
    if (this.logErrors) {
      console.error('Error', err, err.message, '\n', err.stack);
      if (res.privateError) {
        console.error('\n\tWas caused by\n',
          res.privateError.message, '\n',
          res.privateError.stack);
      }
    }
    this.defaultError(req, res);
  }
};

Server.prototype.stop = function(done) {
  // Stop, cleanup, and call the `done` callback when the Server is fully
  // shutdown
  var p = priv.get(this);
  if (p.state === states.listening) {
    p.state = states.stopped;
    this.live = null;
    this.server.close(function() {
      this.emit('stopped');
      done && done.call(this)
    }.bind(this));
  } else {
    this.emit('stopped');
    done && done.call(this);
  }
};

function addHelper(type) {
  // We have adders for several types of functions in the PathNode tree:
  // handlers, errors, and gates. This creates an adder method for one
  // of those type's of things.
  return function(method, pth, fn) {
    // Accept an HTTP method, a path, and a function
    var p = priv.get(this);
    p.paths.add(type, pth, method, fn);
  };
}
function rmHelper(type) {
  // We have removers for several types of functions in the PathNode tree:
  //handlers, errors, and gates. This creates a remover method for one of
  // those type's of things.
  return function(method, pth, fn) {
    var p = priv.get(this);
    return p.paths.remove(type, pth, method);
  };
}

// Define a bunch of adders and removers
Server.prototype.register = addHelper('handlers');
Server.prototype.unregister = rmHelper('handlers');
Server.prototype.addGate = addHelper('gates');
Server.prototype.removeGate = rmHelper('gates');
Server.prototype.addError = addHelper('errors');
Server.prototype.removeError = rmHelper('errors');

module.exports = Server;

