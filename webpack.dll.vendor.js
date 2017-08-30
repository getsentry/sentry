/*eslint-env node*/
const path = require('path');

const webpack = require('webpack');

const [appConfig] = require('./webpack.config');

const staticPrefix = 'src/sentry/static/sentry',
  distPath = path.join(__dirname, staticPrefix, 'dist');

// this is set by setup.py sdist
if (process.env.SENTRY_STATIC_DIST_PATH) {
  distPath = process.env.SENTRY_STATIC_DIST_PATH;
}

// const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// const IS_TEST = process.env.NODE_ENV === 'TEST' || process.env.TEST_SUITE;
// const WEBPACK_DEV_PORT = process.env.WEBPACK_DEV_PORT;
// const SENTRY_DEVSERVER_PORT = process.env.SENTRY_DEVSERVER_PORT;

const vendorDll = Object.assign({}, appConfig, {
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
