#!/usr/bin/env node
/* eslint no-console:0 import/no-nodejs-modules:0 */
const CLIEngine = require('eslint').CLIEngine;

let cli;

function setup(extensions) {
  cli = new CLIEngine({
    fix: false,
    extensions: extensions,
    configFile: '.eslintrc.relax.js',
  });
}

// Lint all files

function lintFiles(filenames) {
  return cli.executeOnFiles(filenames);
}

module.exports = {setup, lintFiles};
