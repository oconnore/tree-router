'use strict';

var chai = require('chai');
var assert = chai.assert;
var sinon = require('sinon');

var utils = require('../src/utils');

suite('Utils', function() {

  suite('Async', function() {
    var clock;

    test('Create a generator', function(done) {
      var g = utils.async.generator(done);
      g()();
    });

    test('Throw an error in a generator', function(done) {
      var called = false;
      var finish = function() {
        assert.ok(called);
        done();
      };
      var g = utils.async.generator(function(err) {
        assert.ok(err); 
        called = true;
        finish();
      });
      var a = g();
      var b = g();
      b(new Error('test'));
    });

    test('Remove duplicates', function() {
      var count = 0;
      var g = utils.async.generator(function(err) {
        count++;
      });
      var a = g();
      a();
      assert.equal(count, 1);
      a();
      assert.equal(count, 1);
    });

    test('Use the generator', function(done) {
      this.slow(200);
      var alldone = null, count = 0;
      var finish = function() {
        assert.ok(alldone);
        done();
      }
      var gen = utils.async.generator(function(err) {
        assert.ok(!err);
        alldone = true;
        finish();
      });
      var loop = gen();
      assert.notOk(alldone);
      var dist = 10;
      var startTime = Date.now();
      for (var i = 0; i < 10; i++) {
        (function(i, cb) {
          setTimeout(function() {
            count++;
            cb();
          }, i * dist);
        })(i, gen());
      }
      assert.equal(count, 0);
      var fn = function(i) {
        if (i < 10) {
          assert.equal(count, Math.floor((Date.now() - startTime) / dist) + 1);
          setTimeout(fn.bind(null, i + 1), dist);
        }
      };
      setTimeout(fn.bind(null, 1), 0);
      loop();
    });
  });
});
