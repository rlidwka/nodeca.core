// `i18n` section processor
//


'use strict';


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var _          = require('lodash');
var BabelFish  = require('babelfish');
var fstools    = require('fs-tools');
var yaml       = require('js-yaml');
var MarkdownIt = require('markdown-it');


// internal
var stopwatch = require('../utils/stopwatch');
var findPaths = require('./utils/find_paths');


////////////////////////////////////////////////////////////////////////////////


var wrapper_template_path = path.join(__dirname, 'i18n', 'wrapper.tpl');
var wrapper_template = _.template(fs.readFileSync(wrapper_template_path, 'utf8'));


////////////////////////////////////////////////////////////////////////////////


//  initLocalesConfig(N, knownLocales) -> Void
//  - knownLocales (Array): List of found locales.
//
//  Initialize, validate and auto-fill (if needed) N.config.locales
//
function initLocalesConfig(N, knownLocales) {
  // That's almost impossible, but can cause nasty error with default config:
  // if no translation files found - set `en-US` locale by default
  if (_.isEmpty(knownLocales)) {
    knownLocales = [ 'en-US' ];
  }

  var localesConfig  = N.config.locales         || (N.config.locales = {})
    , enabledLocales = localesConfig.enabled || knownLocales
    , defaultLocale  = localesConfig.default || enabledLocales[0];

  if (!_.contains(enabledLocales, defaultLocale)) {
    throw new Error('Default locale <' + defaultLocale + '> must be enabled');
  }

  // reset languages configuration
  N.config.locales.default = defaultLocale;
  N.config.locales.enabled = enabledLocales;
}


// Load translations from the given file (by path) using proper YAML settings.
// It uses JS-YAML's FAILSAFE_SCHEMA for security reasons, i.e. no functions,
// no merges, no regexps, etc. Only plain objects, arrays and strings.
//
function loadI18nFile(file) {
  var contents = fs.readFileSync(file, 'utf8')
    , result   = yaml.load(contents, { schema: yaml.FAILSAFE_SCHEMA, filename: file });

  return result;
}


////////////////////////////////////////////////////////////////////////////////


module.exports = function (sandbox) {
  var N                = sandbox.N,
    knownLocales       = [],
    serverI18n         = null,
    clientI18n         = null,
    clientI18nPackages = [],
    tmpdir             = sandbox.tmpdir,
    timer              = stopwatch(),
    md                 = new MarkdownIt({ html: true, linkify: true, typographer: true });

  // Initialize BabelFishes
  // Fallback locale != default locale.
  // We use 'en-US' because it should always contain all phrases.
  serverI18n = new BabelFish('en-US');
  clientI18n = {};

  _.keys(sandbox.config.packages).forEach(function (pkgName) {
    clientI18n[pkgName] = new BabelFish('en-US');
  });

  // Convert all phrases with prefix 'md:' from Markdown to HTML
  function markdownify(phrases) {

    return _.mapValues(phrases, function (value) {

      if (value.length > 3 && value.substring(0, 3) === 'md:') {
        return md.render(value.substring(3));
      }

      return value;
    });
  }

  function addServerI18n(locale, apiPath, phrases) {
    var mdPhrases = markdownify(phrases);

    serverI18n.addPhrase(locale, apiPath, mdPhrases);

    if (!_.contains(knownLocales, locale)) {
      knownLocales.push(locale);
    }
  }

  function addClientI18n(locale, pkgName, apiPath, phrases) {
    var mdPhrases = markdownify(phrases);

    serverI18n.addPhrase(locale, apiPath, mdPhrases);
    clientI18n[pkgName].addPhrase(locale, apiPath, mdPhrases);

    if (!_.isEmpty(phrases) && !_.contains(clientI18nPackages, pkgName)) {
      clientI18nPackages.push(pkgName);
    }

    if (!_.contains(knownLocales, locale)) {
      knownLocales.push(locale);
    }
  }

  // Collect translations of all packages (in modules tree).
  _.forEach(sandbox.config.packages, function (pkgConfig, pkgName) {

    findPaths(pkgConfig.i18n_client, function (fsPath, apiPath) {
      _.forEach(loadI18nFile(fsPath), function (phrases, locale) {
        addClientI18n(locale, pkgName, apiPath, phrases);
      });
    });

    findPaths(pkgConfig.i18n_server, function (fsPath, apiPath) {
      _.forEach(loadI18nFile(fsPath), function (phrases, locale) {
        addServerI18n(locale, apiPath, phrases);
      });
    });
  });

  // Collect global translations.
  _.forEach(N.config.i18n, function (locale, localeName) {
    _.forEach(locale, function (phrases, pkgName) {
      addClientI18n(localeName, pkgName, pkgName, phrases);
    });
  });

  // Correct the application config if needed
  initLocalesConfig(N, knownLocales);

  // Write client-side i18n bundles for each package and locale.
  _.keys(sandbox.config.packages).forEach(function (pkgName) {
    var outdir = path.join(tmpdir, 'i18n', pkgName);

    fstools.mkdirSync(outdir);

    _.forEach(N.config.locales.enabled, function (locale) {
      var result = '', outfile = path.join(outdir, locale + '.js');

      result = wrapper_template({
        locale: locale,
        data: clientI18n[pkgName].stringify(locale)
      });

      fs.writeFileSync(outfile, result, 'utf8');
    });
  });

  // Expose server locales.
  N.i18n = serverI18n;

  // Expose list of packages with client-side i18n.
  sandbox.clientI18nPackages = clientI18nPackages;

  N.logger.info('Processed i18_* sections %s', timer.elapsed);
};
