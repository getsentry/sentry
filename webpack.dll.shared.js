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

const sharedDll = Object.assign({}, appConfig, {
  entry: {
    shared: appConfig.entry.shared
  }
});

sharedDll.plugins = appConfig.plugins
  .filter(plugin => !(plugin instanceof webpack.optimize.CommonsChunkPlugin))
  .concat([
    new webpack.DllReferencePlugin({
      context: __dirname,
      manifest: require(path.resolve(distPath, 'vendor-manifest.json')),
      name: 'vendor',
      extensions: ['', '.js', '.jsx']
    }),
    new webpack.DllPlugin({
      path: path.join(distPath, '[name]-manifest.json'),
      context: path.join(__dirname, staticPrefix, 'app'),
      name: '[name]'
    })
  ]);

module.exports = [sharedDll];
