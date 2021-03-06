'use strict';


module.exports = function (N) {
  var Wire      = require('../wire');
  var Pointer   = require('pointer');
  var BabelFish = require('babelfish');

  N.runtime         = N.runtime || {};
  N.router  = new Pointer('$$ N.router.stringify() $$');

  // No need to set default locale in constructor, since we use 1
  // language on client.
  N.i18n    = new BabelFish('en-US');

  // translation helper with active locale
  N.runtime.t = function (phrase, params) {
    return N.i18n.t(N.runtime.locale, phrase, params);
  };

  N.runtime.t.exists = function (phrase) {
    return N.i18n.hasPhrase(N.runtime.locale, phrase);
  };

  N.wire           = new Wire();
  N.logger         = require('./kernel/logger');
  N.io             = require('./kernel/io')(N);
  N.runtime.render = require('./kernel/render')(N);

  // refer runtime in templates wrappers. Needed to render templates.
  N.__jade_runtime = require('jade/lib/runtime.js');

  N.enviroment     = '$$ JSON.stringify(N.enviroment) $$';
  N.version        = '$$ JSON.stringify(N.version) $$';
};
