'use strict';

var http = require('http');
var Server = require('./server');

// A special error used to tell the error handler to find the next parent
// handler;
function Bubble() {}
Bubble.prototype.__proto__ = Error.prototype;

function Response(httpRes) {
  this.response = httpRes;
}

Response.prototype = {
  __proto__: http.ServerResponse.prototype,
  constructor: Response,
  bubble: function() {
    // An error handler calls response.bubble() when it cannot handle this
    // type of error. The Server will then look for an error handler in
    // one of the parent nodes to handle this error.
    throw new Bubble();
  },
  send: function(value) {
    var nl = false, len;
    if (typeof value !== 'string') {
      if (!this.getHeader('Content-Type')) {
        this.setHeader('Content-Type', 'applicaton/json');
      }
      value = JSON.stringify(value);
      len = value.length + 1;
      nl = true;
    } else {
      len = value.length;
    }
    this.setHeader('Content-Length', len);
    this.write(value);
    if (nl) this.write('\n');
    this.end();
  }
};

exports.Bubble = Bubble;
exports.Response = Response;

