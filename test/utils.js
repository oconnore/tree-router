'use strict';

var chai = require('chai');
var assert = chai.assert;
var sinon = require('sinon');

var utils = require('../src/utils');

suite('Utils', function() {
  test('Extend object', function() {
    var a = {
      cat: 34,
      dog: 98,
      fish: 56,
      dolphin: 4
    };
    var b = {
      dolphin: 112,
      whale: 558
    };
    var c = {
      dog: 9
    };
    var test = {};
    utils.extend(test, a, b, c);
    assert.deepEqual(Object.keys(test).sort(), [
      'cat', 'dog', 'fish', 'dolphin', 'whale'
    ].sort());
    assert.equal(test.dolphin, 112);
    assert.equal(test.fish, 56);
    assert.equal(test.whale, 558);
    assert.equal(test.dog, 9);
  });
  test('Extract properties', function() {
    var target = {
      public_property: 'test 1',
      private_property: 'test 2'
    };
    var ret = utils.extract(target, ['private_property']);
    assert.equal(target['public_property'], 'test 1');
    assert.ok(typeof target['private_property'] === 'undefined');
    assert.equal(ret['private_property'], 'test 2');
  });
});
