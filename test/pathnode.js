'use strict';

var chai = require('chai');
var assert = chai.assert;
var sinon = require('sinon');

var PathNode = require('../src/pathnode');

suite('PathNode Tests', function() {

  function createPathNode() {
    var node = new PathNode();
    var paths = {
      common: ['common'],
      main: ['common', 'a', 'b', 'c', 'd', 'e'],
      gate: ['common', 'preGate', 'gate'],
      error: ['common', 'a', 'b'],
      preGatedError: ['common', 'preGate'],
      postGatedError: ['common', 'preGate', 'gate', 'postGate'],
      gcShallow: ['common', 'gcA'],
      gcDeepC: ['common', 'gcA', 'gcB', 'gcC'],
      gcDeepD: ['common', 'gcA', 'gcB', 'gcD']
    };
    var handlers = ['common', 'main', 'gate', 'error', 'postGatedError',
                    'gcShallow', 'gcDeepC', 'gcDeepD'];
    var errors = ['common', 'error', 'preGatedError',
                  'postGatedError'];
    var gates = ['gate'];
    handlers.forEach(function(i) {
      node.add('handlers', paths[i], 'test',
        sinon.spy());
    })
    errors.forEach(function(i) {
      node.add('errors', paths[i], 'test',
        sinon.spy());
    })
    gates.forEach(function(i) {
      node.add('gates', paths[i], 'test',
        sinon.spy());
    });
    return node;
  }

  test('Create a PathNode', function() {
    var node = createPathNode();
    assert.ok(node);
  });

  test('Traverse a PathNode', function() {
    var node = createPathNode();
    var pth = ['common', 'a', 'b', 'c', 'd', 'e'];
    var l = node.lookup(pth);
    assert.ok(l);
    assert.deepEqual(pth, l.path);
    assert.isFunction(l.node.handlers.get('test'));
  });

  test('Traverse an incomplete PathNode', function() {
    var node = createPathNode();
    var pth = ['common', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    var l = node.lookup(pth);
    assert.ok(l);
    assert.deepEqual(['common', 'a', 'b', 'c', 'd', 'e'], l.path);
    assert.deepEqual(['f', 'g', 'h'], l.unused);
  });

  test('Bubble to last handler', function() {
    var node = createPathNode();
    var pth = ['common', 'a', 'b', 'c', 'd'];
    var l = node.lookup(pth);
    var count = 0;
    var handlerNode, handler;
    l.node.bubble(function(n) {
      count++;
      var h = n.handlers.get('test');
      if (h) {
        handler = h,
        handlerNode = n;
        throw new PathNode.StopIteration;
      }
    });
    assert.isFunction(handler);
    assert.equal(count, 3);
  });

  test('Garbage collect unused nodes', function() {
    var node = createPathNode();
    var pth, l;

    pth = ['common', 'gcA', 'gcB', 'gcC'];
    l = node.lookup(pth);
    assert.ok(l.node);
    assert.equal(l.unused.length, 0, 'incomplete match');
    node.remove('handlers', pth, 'test');

    // check that we removed the handler
    l = node.lookup(pth);
    assert.equal(l.unused.length, 1);

    // check that gcC was removed
    l = node.lookup(pth);
    assert.equal(l.unused.length, 1);

    pth = ['common', 'gcA', 'gcB', 'gcD'];
    l = node.lookup(pth);

    // check that gcD was preserved
    assert.ok(l.node);
    assert.equal(l.unused.length, 0, 'incomplete match');

    node.remove('handlers', pth, 'test');

    pth = ['common', 'gcA', 'gcB', 'gcD'];
    l = node.lookup(pth);

    assert.deepEqual(l.path, ['common', 'gcA']);
    assert.deepEqual(l.unused, ['gcB', 'gcD']);
  });

});
