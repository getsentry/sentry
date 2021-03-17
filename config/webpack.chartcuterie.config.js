/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */

const path = require('path');
const childProcess = require('child_process');
const webpack = require('webpack');

const baseConfig = require('../webpack.config');

const commitHash = childProcess.execSync('git rev-parse HEAD').toString().trim();

const findLoader = loaderName =>
  baseConfig.module.rules.find(rule => rule.use.loader === loaderName);

const config = {
  mode: process.env.NODE_ENV || 'development',
  context: baseConfig.context,
  resolve: baseConfig.resolve,

  target: 'node',
  entry: {
    config: 'app/chartcuterieConfig',
  },

  module: {
    rules: [findLoader('babel-loader'), findLoader('po-catalog-loader')],
    noParse: baseConfig.module.noParse,
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env': {COMMIT_SHA: JSON.stringify(commitHash)},
    }),
  ],

  output: {
    path: path.join(__dirname, 'chartcuterie'),
    libraryTarget: 'commonjs2',
  },

  devtool: 'none',
  optimization: {minimize: false},
};

module.exports = config;
