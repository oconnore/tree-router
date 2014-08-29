'use strict';

var chai = require('chai');
var assert = chai.assert;
var sinon = require('sinon');
var http = require('http');
var net = require('net');

var Server = require('../src/server');
var netHelper = require('./tools/network');

suite('Server Operation', function() {
  var server;

  function createServer(opts, cb) {
    stopServer(function() {
      server = new Server(opts);
      cb && cb(server);
    });
  }

  function stopServer(cb) {
    if (server) {
      server.stop(function() {
        server = null;
        cb && cb(true);
      });
    } else {
      cb && cb(false);
    }
  }

  function createRunningServer(callback) {
    createServer({ port: 8080 }, function() {
      server.start(function() {
        assert.ok(typeof server.live.port === 'number', 'We didn\'t get a port!');
        callback && callback(server);
      });
    });
  }

  function registerHandlers() {
    server.register('GET', [], function(req, res) {
      var body = 'Base request';
      res.setHeader('X-Remaining-Path', req.remainingPath);
      res.writeHead(200, {
        'Content-Type': 'text/plain'
      });
      res.write(body);
      res.end();
    });
    server.addError('GET', [], function(req, res) {
      var body = 'Base error';
      res.setHeader('Reason', res.error.message);
      res.writeHead(res.statusCode);
      res.write(body);
      res.end();
    });
    server.addError('GET', ['first'], function(req, res) {
      if (res.statusCode === 598) {
        res.bubble();
      }
      var msg = res.error.message || 'unknown';
      res.setHeader('Reason', msg);
      res.writeHead(res.statusCode);
      res.write(msg);
      res.end();
    });

    server.register('GET', ['first', 'second'], function(req, res) {
      if (req.query['error']) {
        res.error = new Error(req.query['error']);
        res.statusCode = parseInt(req.query['status']) || 567;
        throw res.error;
      } else {
        res.write('second handler');
        res.end();
      }
    });

    server.register(Server.AnyMethod, ['first', 'anyhandler', 'third'],
      function(req, res) {
      res.error = new Error('Third handler always throws an error');
      res.statusCode = 523;
      throw res.error;
    });

    server.addError(Server.AnyMethod, ['first', 'anyhandler'],
      function(req, res) {
      res.setHeader('Reason', 'anyhandler works on '+req.method);
      res.writeHead(res.statusCode);
      res.write('anyhandler');
      res.end();
    });

    server.addGate(Server.AnyMethod, ['first', 'anyhandler'],
      function(req, res) {
      res.setHeader('X-PassedAnyGate', true);
    });

    server.register('GET', ['gate', 'request'], function(req, res) {
      var body = 'Test gate';
      res.writeHead(200, {
        'Success': 'true'
      });
      res.write('Success!');
      res.end();
    });

    server.addGate('GET', ['gate'], function(req, res) {
      if (typeof req.query['gateCheck'] !== 'undefined' &&
          req.query.gateCheck === 'pass') {
        res.setHeader('X-PassedGate', true);
      } else {
        res.statusCode = 403;
        res.error = new Error('Authentication denied');
        throw res.error;
      }
    });
  }

  teardown(function(done) {
    stopServer(function() {
      server = null;
      done();
    });
  });

  test('Create a server', function(done) {
    createServer({
      port: null
    }, function() {
      server.start(function() {
        assert.ok(typeof server.live.port === 'number');
        netHelper.connectPort(server.live.port, function(connected) {
          assert.ok(connected);
          done();
        });
      });
    });
  });

  suite('Timeouts', function() {
    test('No hard timeout', function(done) {
      this.timeout(14000);
      this.slow(10000);
      createServer({
        port: null,
        timeouts: {
          soft: 50,
          hard: 0 
        }
      }, function() {
        var wrote = false, start = Date.now();
        server.start(function() {
          var conn = net.connect({port: server.live.port}, function() {
            setTimeout(function() {
              conn.write('GET /test HTTP/1.1', function() {
                setTimeout(function() {
                  if (!conn.destroyed) {
                    conn.write('hello world', function() {
                      wrote = true;
                      conn.end();
                    });
                  }
                }, 30);
              });
            }, 30);
            conn.on('close', function() {
              try {
                assert.ok(wrote, 'socket should allow write');
                var diff = Date.now() - start;
                assert.ok(diff > 60, 'setTimeouts didnt work');
                conn.destroy();
                done();
              } catch(err) {
                done(err);
              }
            });
          });
        });
      });
    });
    test('Long timeouts', function(done) {
      this.timeout(14000);
      this.slow(10000);
      createServer({
        port: null,
        timeouts: {
          soft: 1000,
          hard: 1000
        }
      }, function() {
        var wrote = false, start = Date.now();
        server.start(function() {
          var conn = net.connect({port: server.live.port}, function() {
            setTimeout(function() {
              conn.write('GET /test HTTP/1.1', function() {
                setTimeout(function() {
                  if (!conn.destroyed) {
                    conn.write('hello world', function() {
                      wrote = true;
                      conn.end();
                    });
                  }
                }, 100);
              });
            }, 100);
            conn.on('close', function() {
              try {
                assert.ok(wrote, 'socket should allow write');
                conn.destroy();
                done();
              } catch(err) {
                done(err);
              }
            });
          });
        });
      });
    });

    test('Soft timeouts', function(done) {
      this.slow(200);
      createServer({
        port: null,
        timeouts: {
          soft: 30,
          hard: 60
        }
      }, function() {
        var wrote = false, start = Date.now();
        server.start(function() {
          var conn = net.connect({port: server.live.port}, function() {
            setTimeout(function() {
              conn.write('GET /test HTTP/1.1', function() {
                setTimeout(function() {
                  if (!conn.destroyed) {
                    conn.write('hello world', function() {
                      wrote = true;
                      conn.end();
                    });
                  }
                }, 45);
              });
            }, 15);
            conn.on('close', function() {
              assert.ok(!wrote, 'socket should have closed');
              assert.ok(Date.now() - start > 30,
                'no increase in timeout during write');
              conn.destroy();
              done();
            });
          });
        });
      });
    });

    test('Hard timeouts', function(done) {
      this.slow(200);
      createServer({
        port: null,
        timeouts: {
          soft: 30,
          hard: 55
        }
      }, function() {
        var count = 0, start = Date.now();
        server.start(function() {
          var conn = net.connect({port: server.live.port}, function() {
            conn.write('GET /test HTTP/1.1\r\n', function() {
              function nextHeader() {
                if (!conn.destroyed && count < 10) {
                  conn.write('Header'+count+': hello world\r\n', function() {
                    count++;
                    setTimeout(nextHeader, 15);
                  });
                } else {
                  conn.destroy();
                }
              }
              setTimeout(nextHeader, 15);
            });
            conn.on('close', function() {
              assert.ok(conn.destroyed, 'socket should have closed');
              assert.ok((Date.now() - start) > 50,
                'no increase in timeout during write: '+(Date.now() - start));
              assert.ok(count > 2, 'should have written several headers');
              conn.destroy();
              done();
            });
          });
        });
      });
    });
  })

  test('Register a handler', function(done) {
    var pth = '/index.html'
    var body = 'abcdefghijklmnopqrstuvwxyz';
    createRunningServer(function() {
      registerHandlers();

      server.register('GET', pth, function(req, res) {
        res.setHeader('success', 'true')
        res.writeHead(200);
        res.write(body);
        res.end();
      });

      netHelper.request({ port: server.live.port, path: pth },
        function(err, res, data) {
        assert.ok(!err, 'Error in request');
        assert.ok(res, 'No response');
        assert.equal(res.statusCode, 200, 'Non 200 response');
        assert.equal(data, body);
        done();
      });
    });
  });

  test('Catch an error', function(done) {
    createRunningServer(function() {
      registerHandlers();

      netHelper.request({
        port: server.live.port,
        path: '/first/second?error=Test%20error'
      }, function(err, res, data) {
        assert.equal(res.statusCode, 567);
        assert.equal(res.headers['reason'], 'Test error');
        assert.equal(data, 'Test error');
        done();
      });
    });
  });

  test('Bubble an error', function(done) {
    createRunningServer(function() {
      registerHandlers();

      netHelper.request({
        port: server.live.port,
        path: '/first/second?error=Test%20error&status=598'
      }, function(err, res, data) {
        assert.equal(res.statusCode, 598);
        assert.equal(res.headers['reason'], 'Test error');
        assert.equal(data, 'Base error');
        done();
      });
    });
  });

  test('Fail a gate authentication check', function(done) {
    createRunningServer(function() {
      registerHandlers();

      netHelper.request({
        port: server.live.port,
        path: '/gate/request'
      }, function(err, res, data) {
        assert.equal(res.statusCode, 403);
        assert.equal(res.headers['reason'], 'Authentication denied');
        done();
      });
    });
  });

  test('Pass a gate authentication check', function(done) {
    createRunningServer(function() {
      registerHandlers();

      netHelper.request({
        port: server.live.port,
        path: '/gate/request?gateCheck=pass'
      }, function(err, res, data) {
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['success'], 'true');
        assert.equal(res.headers['x-passedgate'], 'true');
        done();
      });
    });
  });

  test('Server.AnyMethod handler lookups', function(done) {
    createRunningServer(function() {
      registerHandlers();

      var first = false, second = false;

      function maybeDone() {
        if (first && second) {
          done();
        }
      }

      netHelper.request({
        port: server.live.port,
        path: '/first/anyhandler/third',
        method: 'GET'
      }, function(err, res, data) {
        assert.equal(res.headers['x-passedanygate'], 'true');
        assert.equal(res.statusCode, 523);
        assert.equal(res.headers['reason'], 'anyhandler works on GET');
        first = true;
        maybeDone();
      });

      netHelper.request({
        port: server.live.port,
        path: '/first/anyhandler/third',
        method: 'POST'
      }, function(err, res, data) {
        assert.equal(res.headers['x-passedanygate'], 'true');
        assert.equal(res.statusCode, 523);
        assert.equal(res.headers['reason'], 'anyhandler works on POST');
        second = true;
        maybeDone();
      });
    });
  });

  test('Shutdown a server', function(done) {
    createServer({
      port: null
    }, function() {

      server.start(function() {
        var port = server.live.port;
        server.stop(function() {
          assert.ok(!server.live, 'Server hasn\'t been shutdown');
          netHelper.connectPort(port, function(connected) {
            assert.notOk(connected);
            done();
          });
        });
      });

    });
  });
});
