var Server = require('../../src/server').Server;

var server = new Server({
  hostname: '127.0.0.1',
  port: 3000,
});

server.addError(Server.AnyMethod, [], function(req, res) {
  res.statusCode = 500;
  res.send('whoops: ' + res.error.message + '\n');
});

server.register('GET', ['first', 'page'], function(req, res) {
  res.send('hello world\n');
});

server.register('GET', ['first', 'error'], function(req, res) {
  res.error = new Error('something went wrong');
});

server.start(function(err) {
  if (err) return;
  console.log('Starting on', this.live.port);
});
