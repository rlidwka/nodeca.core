'use strict';


/*global nodeca, _*/


// stdlib
var fs    = require('fs');
var path  = require('path');


// 3rd-party
var views     = require('nlib').Views;
var async     = require('nlib').Vendor.Async;
var fstools   = require('nlib').Vendor.FsTools;
var JASON     = require('nlib').Vendor.JASON;


////////////////////////////////////////////////////////////////////////////////


// buildI18nFiles(root, callback(err)) -> Void
// - root (String): Pathname where to save i18n.js files.
// - callback (Function): Executed once everything is done.
//
// Writes i18n.js file for each ns + locale pair.
//
module.exports = function buildI18nFiles(root, callback) {
  async.forEach(nodeca.config.locales.enabled, function (lang, nextLang) {
    var data = nodeca.runtime.i18n.getCompiledData(lang);

    async.forEach(_.keys(data), function (ns, nextNamespace) {
      var file    = path.join(root, 'system', ns, 'i18n', lang + '.js'),
          output  = 'nodeca.runtime.i18n.load(' +
                    JSON.stringify(lang) + ',' + JSON.stringify(ns) + ',' +
                    JASON.stringify(data[ns]) + ');';

      async.series([
        async.apply(fstools.mkdir, path.dirname(file)),
        async.apply(fs.writeFile, file, output)
      ], nextNamespace);
    }, nextLang);
  }, callback);
};