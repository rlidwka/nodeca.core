'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function dashboard(env, next) {
    env.res.now = (new Date()).toString();
    next();
  });
};
