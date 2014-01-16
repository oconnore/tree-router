'use strict';

var Server = require('../../src/server').Server;
var utils = require('../../src/utils');
var assert = require('assert');

function AuthError() {
  Error.apply(this, arguments);
}
AuthError.prototype = Object.create(Error);

var s = new Server({
  port: 3000
});

s.start(function() {
  console.log('Started server on', s.live.port);
});

s.register('GET', ['auth', 'status'], function(req, res) {
  res.send({
    auth: true 
  });
});

s.addGate(Server.AnyMethod, ['auth'], function(req, res) {
  if (req.headers['x-auth'] === 'open sesame') {
    return;
  } else {
    res.error = new AuthError('Auth denied');
    throw res.error;
  }
});

s.addError(Server.AnyMethod, [], function(req, res) {
  var reply = {reason: res.error.message};
  if (res.privateError instanceof AuthError) {
    reply['auth'] = false;
    res.statusCode = 403;
  } else {
    res.statusCode = 500;
  }
  res.send(reply);
});


