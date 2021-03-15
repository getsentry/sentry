/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */

const path = require('path');
const childProcess = require('child_process');
const webpack = require('webpack');
const CompressionPlugin = require('compression-webpack-plugin');

const baseConfig = require('../webpack.config');

const commitHash = childProcess.execSync('git rev-parse HEAD').toString();

const basePlugins = baseConfig.plugins.filter(
  plugin => !(plugin instanceof CompressionPlugin)
);

const config = {
  ...baseConfig,

  target: 'node',
  entry: {
    config: 'app/chartcuterieConfig',
  },

  optimization: {},

  plugins: [
    ...basePlugins,
    new webpack.DefinePlugin({
      'process.env': {COMMIT_SHA: JSON.stringify(commitHash)},
    }),
  ],

  output: {
    ...baseConfig.output,
    path: path.join(__dirname, 'chartcuterie'),
    libraryTarget: 'commonjs',
  },
};

module.exports = config;
