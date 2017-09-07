const path = require('path');
const webpack = require('webpack');

const staticPath = path.resolve(__dirname, '..', 'src', 'sentry', 'static', 'sentry');
const componentPath = path.resolve(staticPath, 'app', 'components');

const sentryConfig = require('../webpack.config');
const appConfig = sentryConfig[0];
const legacyCssConfig = sentryConfig[1];

module.exports = {
  module: {
    rules: [
      {
        test: /\.po$/,
        loader: 'po-catalog-loader',
        query: {
          referenceExtensions: ['.js', '.jsx'],
          domain: 'sentry'
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.less$/,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader'
          },
          {
            loader: 'less-loader'
          }
        ]
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|gif|ico|jpg)($|\?)/,
        loader: 'file-loader?name=' + '[name].[ext]'
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
      'root.jQuery': 'jquery',
      Raven: 'raven-js',
      underscore: 'underscore',
      _: 'underscore'
    }),
    new webpack.DefinePlugin({
      'process.env': {
        IS_PERCY: true
      }
    })
  ],
  resolve: {
    extensions: appConfig.resolve.extensions,
    alias: Object.assign({}, appConfig.resolve.alias, {
      'sentry-ui': componentPath
    })
  }
};
