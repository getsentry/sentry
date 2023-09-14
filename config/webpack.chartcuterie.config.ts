/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import childProcess from 'child_process';
import path from 'path';

import webpack from 'webpack';

import baseConfig from '../webpack.config';

const commitHash =
  process.env.SENTRY_BUILD ||
  childProcess.execSync('git rev-parse HEAD').toString().trim();

const findLoader = (loaderName: string) =>
  baseConfig.module?.rules?.find(
    rule =>
      rule &&
      typeof rule === 'object' &&
      typeof rule.use === 'object' &&
      !Array.isArray(rule.use) &&
      rule.use.loader === loaderName
  ) as webpack.RuleSetRule;

const config: webpack.Configuration = {
  mode: baseConfig.mode,
  context: baseConfig.context,
  resolve: baseConfig.resolve,

  target: 'node',
  entry: {
    config: 'sentry/chartcuterie/config',
  },

  module: {
    rules: [findLoader('babel-loader'), findLoader('po-catalog-loader')],
    noParse: baseConfig.module?.noParse,
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

  optimization: {minimize: false},
};

module.exports = config;
