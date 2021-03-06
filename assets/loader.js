//= require vendor/modernizr.custom
//= require vendor/bag.js/bag.js
//= require_self


/*eslint-disable no-alert*/


(function (window) {
  'use strict';


  var NodecaLoader = window.NodecaLoader = {};
  var alert = window.alert;


  // Simple cross-browser `forEach` iterator for arrays.
  function forEach(array, iterator) {
    var index, length;

    for (index = 0, length = array.length; index < length; index += 1) {
      iterator(array[index], index);
    }
  }

  function isFunction(object) {
    return '[object Function]' === Object.prototype.toString.call(object);
  }

  // Cached non-operable function.
  function noop() {}


  // Mapping of package names to package metadata for all available packages at
  // the currect locale. The metadata is an object consists of three keys:
  //
  //   `js`            - URL to bundle, containing this package's JS
  //   `css`           - URL to bundle, containing this package's CSS
  //   `packagesQueue` - sorted list of dependencies, including this
  //                     package (just list of package names)
  //
  // This variable is initialized by `loadAssets.init()`.
  var assets;


  // Track loaded URLs (as keys, values are just `true`)
  var loaded = {};


  // Sandbox object passed as an argument to each module.
  // It should be filled via `NodecaLoader.execute`.
  var N = { loader: NodecaLoader };

  // For easy debugging only.
  NodecaLoader.N = N;

  // Returns route match data for the given method (e.g. GET) on the given URL
  // or null if none is found. Requires N to be initialized.
  function findRoute(url, method) {
    var matchArray = N.router.matchAll(url)
      , match
      , index
      , length;

    for (index = 0, length = matchArray.length; index < length; index += 1) {
      match = matchArray[index];

      if (Object.prototype.hasOwnProperty.call(match.meta.methods, method)) {
        return match;
      }
    }

    // Not found.
    return null;
  }


  // Storage of registered Node modules.
  // Keys are absolute file paths like '/absolute/path/to/module.js'
  var nodeModules = {};

  // Storage of module aliases. Needed for vendor modules short names.
  // Keys are short name, values are real paths.
  var nodeModulesAliases = {};

  function registerNodeModule(path, func, deps) {
    // Don't overwrite
    nodeModules[path] = nodeModules[path] || {
      initialized: false
    , func: func
    , internal: { exports: {} }
    , dependencies: deps
    };
  }

  function registerNodeModuleAlias(alias, path) {
    if (!/^[a-z0-9._-]+$/g.test(alias)) {
      throw new Error('Only [ a..z, A..Z, 1..9, ., _, - ] chars allowed for aliases');
    }
    // Don't overwrite
    nodeModulesAliases[alias] = nodeModulesAliases[alias] || path;
  }

  function requireNodeModule(path) {

    if (nodeModulesAliases[path]) {
      path = nodeModulesAliases[path];
    }

    var module = nodeModules[path];

    if (!module) {
      throw new Error('Unknown module "' + path + '"');
    }

    // If it's a first require of the given module, initialize it first.
    if (!module.initialized) {
      module.func.call(
        window // this object
      //, N
      , requireNodeModule
      , module.internal
      , module.internal.exports
      , module.dependencies
      , nodeModules
      );
      module.initialized = true;
    }

    return module.internal.exports;
  }

  // Really needed export.
  NodecaLoader.registerNodeModule      = registerNodeModule;
  NodecaLoader.registerNodeModuleAlias = registerNodeModuleAlias;

  // For easy debugging only.
  NodecaLoader.nodeModules       = nodeModules;
  NodecaLoader.requireNodeModule = requireNodeModule;


  // Storage of registered client modules.
  // Keys are API paths like 'app.method.submethod'
  var clientModules = {};

  function registerClientModule(apiPath, func) {
    clientModules[apiPath] = {
      initialized: false
    , func: func
    , internal: { exports: {}, apiPath: apiPath }
    };
  }

  // Initialize client module. Used once per module.
  function initSingleClientModule(module) {
    function resolveI18nPath(path) {
      if ('@' === path.charAt(0)) {
        return path.slice(1);
      }
      return module.internal.apiPath + '.' + path;
    }

    // Local `t` (translate) function for use only within this module.
    // It allows to use phrase strings relative to the module's API path.
    function translationHelper(phrase, params) {
      return N.runtime.t(resolveI18nPath(phrase), params);
    }

    translationHelper.exists = function translationExistsHelper(phrase) {
      return N.runtime.t.exists(resolveI18nPath(phrase));
    };

    // Execute the module's `func` function. It will populate the exports.
    module.func.call(
      window // this object
    , N
    , requireNodeModule
    , module.internal.exports
    , module.internal
    , translationHelper
    );
  }

  // Initializes all loaded client modules. Once per module.
  function initClientModules() {
    var apiPath, module;

    for (apiPath in clientModules) {
      if (!Object.prototype.hasOwnProperty.call(clientModules, apiPath)) {
        continue;
      }

      module = clientModules[apiPath];

      if (module.initialized) {
        continue;
      }

      initSingleClientModule(module);
      module.initialized = true;
    }
  }

  // Really needed export.
  NodecaLoader.registerClientModule = registerClientModule;

  // For easy debugging only.
  NodecaLoader.clientModules          = clientModules;
  NodecaLoader.initSingleClientModule = initSingleClientModule;
  NodecaLoader.initClientModules      = initClientModules;


  //
  // Configure `bag.js loader
  //
  var bag = new window.Bag({
    timeout: 20000,
    stores: [ 'indexeddb', 'websql' ]
  });

  // Load a package with all of associated assets ans dependences.
  // `preload` parameter is an optional array of URLs which are needed to load
  // before the given package.
  function loadAssets(pkgName, preload, callback) {
    var resources;
    var sheduled = {};

    if (isFunction(preload)) {
      callback = preload;
      preload  = null;
    }

    if (!assets[pkgName]) {
      callback(new Error('We dont know such package (' + pkgName + ')'));
      return;
    }

    // Copy the preload array to allow pushing without side-effects.
    resources = preload ? preload.slice(0) : [];

    forEach(assets[pkgName].packagesQueue, function (dependency) {
      var pkgDist = assets[dependency];

      if (pkgDist.css && !loaded[pkgDist.css] && !sheduled[pkgDist.css]) {
        resources.push(pkgDist.css);
        sheduled[pkgDist.css] = true;
      }

      if (pkgDist.js && !loaded[pkgDist.js] && !sheduled[pkgDist.js]) {
        resources.push(pkgDist.js);
        sheduled[pkgDist.js] = true;
      }
    });


    if (resources.length > 0) {

      var res_list = [];
      forEach(resources, function(url) {
        res_list.push({
          url: url,
          // storage key = file path without hash
          key: url.replace(/-[0-9a-f]{32}([.][a-z]+)$/, '$1')
        });
      });

      bag.require(res_list, function(err/*, data*/) {
        if (err) {
          alert('Asset load error (bag.js): ' + err);
          return;
        }

        forEach(resources, function(url) {
          loaded[url] = true;
        });

        initClientModules();

        if (!N.wire) {
          alert('Asset load error: "N.Wire" unavailable after asset load.');
          return;
        }

        N.wire.emit('init:assets', {}, function (err) {
          if (err) {
            alert('Asset load error: "init:assets" failed. ' + err);
            return;
          }

          callback();
        });
      });
    } else {
      callback();
    }
  }


  // Loads all necessary shims and libraries and assets for given package.
  loadAssets.init = function init(assetsMap, pkgName) {
    var shims = [];

    // Set internal assets map.
    assets = assetsMap;

    // Init can be called only once.
    loadAssets.init = noop;

    // Mark all stylesheets of the given package as loaded, since they are
    // included to head of the page.
    forEach(assets[pkgName].packagesQueue, function (dependency) {
      if (assets[dependency].css) {
        loaded[assets[dependency].css] = true;
      }
    });

    loadAssets(pkgName, shims, function () {
      if (!N.wire) {
        alert('Assets init error. Refresh page & try again. ' +
              'If problem still exists - contact administrator.');
        return;
      }

      // First try to match full URL, if not matched - try without anchor.
      var baseUrl = location.protocol + '//' + location.host + location.pathname
        , route   = findRoute(baseUrl + location.hash, 'get') ||
                    findRoute(baseUrl, 'get');

      if (!route) {
        alert('Init error: failed to detect internal identifier (route) of ' +
              'this page. Refresh page & try again. If problem still exists ' +
              '- contact administrator.');
        return;
      }

      // Execute after DOM is loaded:
      $(function () {
        N.wire.emit([ 'navigate.done', 'navigate.done:' + route.meta.methods.get ], {
          url:     location.href
        , apiPath: route.meta.methods.get
        , params:  route.params
        });
      });
    });
  };

  // Really needed export.
  NodecaLoader.loadAssets = loadAssets;


  // Instantly executes the given `func` function passing `N` and `require`
  // as arguments.
  function execute(func) {
    func.call({}, N, requireNodeModule);
  }

  // Really needed export.
  NodecaLoader.execute = execute;

})(this);
