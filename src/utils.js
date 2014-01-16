'use strict';

var _ = require('lodash');

var col = require('./collections');
var eMap = col.Map;
var eSet = col.Set;

exports.extend = function(initial, args) {
  // Extend an initial object with another object. This is useful for
  // merging default options with a supplied options object.
  args = Array.prototype.slice.call(arguments, 1);
  args.forEach(function(x) {
    for (var i in x) {
      if (x.hasOwnProperty(i)) {
        initial[i] = x[i];
      }
    }
  });
  return initial;
};

exports.extract = function(obj, properties) {
  // Takes an object and a list of strings. Each string is assumed to be
  // a property name, and the property is removed from the passed object
  // and defined on the returned object.
  var ret = {};
  for (var i = 0; i < properties.length; i++) {
    var p = properties[i];
    if (obj.hasOwnProperty(p)) {
      ret[p] = obj[p];
      delete obj[p];
    } else {
      ret[p] = undefined;
    }
  }
  return ret;
};

exports.concatD = function(list, args) {
  for (var i = 1; i < arguments.length; i++) {
    var nlist = arguments[i];
    Array.prototype.push.apply(list, nlist);
  }
  return list;
};

exports.initialize = function(self, priv, opts, defpub, defpriv) {
  // This function initializes an object `self`, and a private object `priv`,
  // with an options object `opts`, and two default objects `defpub` and
  // `defpriv`.
  if (arguments.length === 4) {
    self = this;
  }
  opts = exports.extend({}, defpriv, defpub, opts);
  priv.set(self, exports.extract(opts, Object.keys(defpriv || {})));
  exports.extend(self, opts);
};

exports.repeatString = function rep(str, times) {
  // Repeat a string a bunch of times, useful for indentation.
  var built = [], cur = str;
  for (var i = 0, j = 1; j <= times; i++) {
    if ((times & j) > 0) {
      built.push(cur);
    }
    cur = cur + cur;
    j = j << 1;
  }
  return built.join('');
};

exports.truthy = function() {
  return _.filter(arguments);
};

exports.async = {
  generator: function(callback) {
    var done = false;
    var s = new eSet();
    var release = function(err) {
      if (!done) {
        try {
          if (typeof callback === 'function') {
            callback(err);
          }
        } catch (e) {}
        done = true;
      }
    };
    var makeHook = function makeHook() {
      var value = {};
      s.add(value);
      return function hook(err) {
        if (err) {
          release(err);
          return;
        }
        s.delete(value);
        if (s.size === 0) {
          release();
        }
      };
    };
    return makeHook;
  }
};

