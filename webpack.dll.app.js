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

var main = Object.assign({}, appConfig, {
  entry: {
    app: appConfig.entry.app
  }
});

main.plugins = appConfig.plugins
  // .filter(plugin => !(plugin instanceof webpack.optimize.CommonsChunkPlugin))
  .concat([
    new webpack.DllReferencePlugin({
      context: __dirname,
      manifest: require(path.resolve(distPath, 'vendor-manifest.json')),
      name: 'vendor',
      extensions: ['', '.js', '.jsx']
    }),
    new webpack.DllReferencePlugin({
      context: path.resolve(__dirname, staticPrefix, 'app'),
      manifest: require(path.resolve(distPath, 'shared-manifest.json')),
      name: 'shared',
      extensions: ['', '.js', '.jsx']
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      minChunks: Infinity
    })
  ]);

module.exports = [main].concat(config.slice(1));
