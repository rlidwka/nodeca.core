/**
 *  io
 *
 *  This module provides realtime communication methods for Nodeca.
 **/


'use strict';


var _ = require('lodash');


// Last XMLHttpRequest object used for RPC request to allow interrupt it.
//var __lastRPCRequest__ = null;


// IO status/error codes used by RPC and HTTP servers.
_.assign(exports, require('../../io'));


// Checks for a non-system error which should be passed to the callback.
//
function isNormalCode(code) {
  return 200 <= code && code <= 299      ||
         300 <= code && code <= 399      ||
         exports.FORBIDDEN      === code ||
         exports.NOT_FOUND      === code ||
         exports.CLIENT_ERROR   === code;
}


// Checks for a system-level error which should *NOT* be passed to the callback.
// These errors are emitted to 'io.error' Wire channel.
//
function isErrorCode(code) {
  return !isNormalCode(code);
}


/**
 *  rpc can be called in node style (with last callback), or via chained handlers.
 *
 *  ---
 *
 *  With last callback parameter you should handle all non-system errors in your callback.
 *
 *  rpc(name, [params], [options], callback) -> Void
 *
 *  Example:
 *
 *    rpc('core.test', function (error, response) {});
 *
 *  ---
 *
 *  With chained handlers - in 'fail' you can handle only client errors
 *
 *  rpc(name, [params], [options]) -> Object { done(res): Function, fail(err): Function }
 *
 *  Example:
 *
 *    // .fail - called on N.io.CLIENT_ERROR
 *    // .done - called if no errors
 *    rpc('core.test')
 *      .done(function (response) { ... })
 *      .fail(function (clientError) { ... });
 *
 **/
function rpc(name, params, options, callback) {
  var xhr;
  var done = [];
  var fail = [];

  // Scenario: rpc(name, callback);
  if (_.isFunction(params)) {
    callback = params;
    params = options = {};
  }

  // Scenario: rpc(name, params[, callback]);
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  // fill in defaults
  options = options || { _retryOnCsrfError: true };

  // Interrupt previous RPC request.
  //if (__lastRPCRequest__) {
  //  (__lastRPCRequest__.reject || $.noop)();
  //  __lastRPCRequest__ = null;
  //}

  // Send request
  N.wire.emit('io.request');

  xhr = /*__lastRPCRequest__ =*/ $.post('/io/rpc', JSON.stringify({
    version: N.runtime.version
  , method:  name
  , csrf:    N.runtime.csrf
  , params:  params
  }));

  // Listen for a response.
  xhr.success(function (data) {
    data = data || {};

    if (data.version !== N.runtime.version) {
      data.error = {
        code:    exports.EWRONGVER
      , message: 'Client version does not match server.'
      };
      delete data.res;
    }

    // If invalid CSRF token error and retry is allowed.
    if (data.error && exports.INVALID_CSRF_TOKEN === data.error.code && options._retryOnCsrfError) {
      // Renew CSRF token.
      N.runtime.csrf = data.error.data.token;

      // Only one attempt to retry is allowed.
      options._retryOnCsrfError = false;

      // Try again.
      rpc(name, params, options, callback);
      return;
    }

    // If system error - just show notification
    if (data.error && isErrorCode(data.error.code)) {
      N.wire.emit('io.error', data.error);
      N.wire.emit('io.complete', { error: data.error, res: data.res });
      return;
    }

    // If called with callback - don't emit notification. User should care about non-system errors
    if (callback) {
      callback(data.error, data.res);
      N.wire.emit('io.complete', { error: data.error, res: data.res });
      return;
    }

    if (data.error) {
      // If client error and have listeners - don't show default notification
      if (data.error.code === exports.CLIENT_ERROR && fail.length > 0) {
        fail.forEach(function (fn) {
          fn(data.error);
        });
        N.wire.emit('io.complete', { error: data.error, res: data.res });
        return;
      }

      // Show notification without any callback
      N.wire.emit('io.error', data.error);
      N.wire.emit('io.complete', { error: data.error, res: data.res });
      return;
    }

    // Finish on success
    done.forEach(function (fn) {
      fn(data.res);
    });
    N.wire.emit('io.complete', { error: data.error, res: data.res });

    return;
  });

  // Listen for an error.
  xhr.fail(function (jqXHR, status) {
    var err;

    // For possible status values see: http://api.jquery.com/jQuery.ajax/
    if ('abort' === status) {
      return;
    }

    N.logger.error('Failed RPC call: %s', status, jqXHR);

    // Any non-abort error - is a communication problem.
    err = { code: exports.ECOMMUNICATION };

    N.wire.emit('io.error', err);
    N.wire.emit('io.complete', { error: err, response: null });
  });

  // Can't use callback and chaining at the same time
  if (callback) {
    return;
  }

  var curry = {
    done: function (fn) {
      done.push(fn);
      return curry;
    },
    fail: function (fn) {
      fail.push(fn);
      return curry;
    }
  };
  return curry;
}


exports.rpc = rpc;