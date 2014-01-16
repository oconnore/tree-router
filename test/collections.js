'use strict';

var col = require('../src/collections');
var eMap = col.Map, eSet = col.Set;

var chai = require('chai');
var assert = chai.assert;


suite('Collections', function() {

  test('Enumerate a Map', function() {
    var m = new eMap();
    m.set(1, 'A');
    m.set(2, 'B');
    m.set(3, 'C');
    var sawA = false, sawB = false, sawC = false;
    m.forEach(function(value, key) {
      switch(key) {
        case 1:
          assert.deepEqual(value, 'A');
          sawA = true;
          break;
        case 2:
          assert.deepEqual(value, 'B');
          sawB = true;
          break;
        case 3:
          assert.deepEqual(value, 'C');
          sawC = true;
          break;
      }
    });
    assert.ok(sawA, 'saw A');
    assert.ok(sawB, 'saw B');
    assert.ok(sawC, 'saw C');
  });

  test('Enumerate a Set', function() {
    var m = new eSet();
    m.add('A');
    m.add('B');
    m.add('C');
    var sawA = false, sawB = false, sawC = false;
    m.forEach(function(value) {
      switch(value) {
        case 'A':
          sawA = true;
          break;
        case 'B':
          sawB = true;
          break;
        case 'C':
          sawC = true;
          break;
      }
    });
    assert.ok(sawA, 'saw A');
    assert.ok(sawB, 'saw B');
    assert.ok(sawC, 'saw C');
  });

  test('Delete an element from a Map size=1', function() {
    var m = new eMap();
    m.set('A', 1);
    m.delete('A');
    assert.equal(m.size, 0);
    var count = 0;
    m.forEach(function(x, key) {
      count++;
    });
    assert.equal(count, 0);
  });

  test('Delete an element from a Map size=2', function() {
    var m = new eMap();
    m.set('A', 1);
    m.set('B', 2);
    m.delete('A');
    assert.equal(m.size, 1, 'size is not 1');
    var count = 0;
    m.forEach(function(x, key) {
      assert.equal(key, 'B', 'wrong key');
      assert.equal(x, 2, 'wrong value');
      count++;
    });
    assert.equal(count, 1, 'wrong count');
  });
});

