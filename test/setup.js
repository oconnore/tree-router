'use strict';

var fs = require('fs');
var path = require('path');
var events = require('events');
var _ = require('lodash');
var Mocha = require('mocha');
var tdd = require('mocha/lib/interfaces/tdd');
var chai = require('chai');

exports.realTimers = {
  setTimeout: setTimeout,
  setInterval: setInterval,
  clearTimeout: clearTimeout,
  clearInterval: clearInterval
};

// enable stack traces during testing
chai.Assertion.includeStack = true;
var mochainst = new Mocha({
  title: 'test 1',
  ui: 'tdd',
  reporter: 'spec'
});
function getUI(mocha) {
  // Mocha hack to allow us to call mocha functions from inside an AMD module.
  // Typically the `mocha` cli would do this for us.
  var uie = new events.EventEmitter, ui = {};
  tdd(uie);
  uie.emit('pre-require', ui, null, mocha);
  uie.__proto__ = mochainst.suite;
  return ui;
}
var mochaui = getUI(mochainst);
var mochaglobals = ['suite', 'test', 'setup', 'suiteSetup', 'teardown', 'suiteTeardown'];
mochaglobals.forEach(function(x) {
  global[x] = mochaui[x];
});

var testDir = path.dirname(path.resolve(process.cwd, process.argv[1]));
function gettests(cb) {
  // Tests go in the test/ directory, subdirectories are used for helpers
  fs.readdir(testDir, function(err, testlist) {
    if (err) {
      cb(err);
      return;
    }
    _.remove(testlist, function(x) {
      return x === 'setup.js' || !(/^[a-z0-9_-]+\.js$/i.exec(x));
    });
    testlist = testlist.map(function(x) {
      return path.join(testDir, x);
    });
    cb && cb(null, testlist);
  });
}

gettests(function(err, testslist) {
  if (err) {
    console.log('Error:', err.message);
    return;
  }

  testslist.forEach(function(x) {
    require(x.substr(0, x.length - 3));
  })
  // Run the tests!
  mochainst.run();
});

