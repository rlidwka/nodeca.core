'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function (env, next) {
    env.response.data.categories = N.settings.getStore('global').getCategories();
    next();
  });
};
