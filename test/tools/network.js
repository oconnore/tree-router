'use strict';

var http = require('http');
var net = require('net');
var utils = require('../../src/utils');

function connectPort(port, cb) {
  var conn = net.connect({ port: port }, function() {
    conn.destroy();
    cb(true);
  });
  conn.on('error', cb.bind(null, false));
}

function request(opts, callback) {
  opts = utils.extend({
    hostname: 'localhost',
    path: '/',
    method: 'GET',
    headers: {
      'Host': 'localhost',
      'Connection': 'close'
    }
  }, opts);
  var data = [];
  var req = http.request(opts, function(res) {
    var pos = 0;
    res.setEncoding('utf8');
    req.on('close', function() {
      var tmp = callback;
      callback = null;
      tmp && tmp(null, res, data.join(''));
    });
    res.on('data', function(chunk) {
      data.push(chunk);
    });
  });
  req.on('error', function(err) {
    var tmp = callback;
    callback = null;
    tmp && tmp(err, null, null);
  });
  req.end();
}

[
  connectPort,
  request
].forEach(function(x) {
  exports[x.name] = x;
});
