/*eslint-env node*/
/*eslint no-var:0*/
var path = require('path');

var webpack = require('webpack');

var config = require('./webpack.config');
var appConfig = config[0];

var staticPrefix = 'src/sentry/static/sentry';
var distPath = path.join(__dirname, staticPrefix, 'dist');

// this is set by setup.py sdist
if (process.env.SENTRY_STATIC_DIST_PATH) {
  distPath = process.env.SENTRY_STATIC_DIST_PATH;
}

// var IS_PRODUCTION = process.env.NODE_ENV === 'production';
// var IS_TEST = process.env.NODE_ENV === 'TEST' || process.env.TEST_SUITE;
// var WEBPACK_DEV_PORT = process.env.WEBPACK_DEV_PORT;
// var SENTRY_DEVSERVER_PORT = process.env.SENTRY_DEVSERVER_PORT;

var vendorDll = Object.assign({}, appConfig, {
  entry: {
    vendor: appConfig.entry.vendor
  }
});

vendorDll.plugins = appConfig.plugins
  .filter(plugin => !(plugin instanceof webpack.optimize.CommonsChunkPlugin))
  .concat([
    new webpack.DllPlugin({
      path: path.join(distPath, '[name]-manifest.json'),
      context: __dirname,
      name: '[name]'
    })
  ]);

module.exports = [vendorDll];
