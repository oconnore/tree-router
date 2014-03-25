'use strict';

var Server = require('../../src/server');

var s = new Server({
  port: 3000
});

s.start(function() {
  console.log('Started server on', s.live.port);
});

s.register('GET', [], function(req, res) {
  res.send('Hello world!\n');
});

