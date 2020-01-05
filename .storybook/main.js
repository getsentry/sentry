/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const path = require('path');
const webpack = require('webpack');
const appConfig = require('../webpack.config');

const staticPath = path.resolve(
  __dirname,
  '..',
  'src',
  'sentry',
  'static',
  'sentry',
  'app'
);

module.exports = {
  stories: ['../docs-ui/components/*.stories.*'],
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {configureJSX: true},
    },
    '@storybook/addon-storysource',
    '@storybook/addon-knobs',
    '@storybook/addon-actions',
    '@storybook/addon-a11y',
    '@storybook/addon-options',
  ],
  // webpack: config => {

  // const filteredRules = rules.filter(rule => {
  // return (
  // (!rule.loader || !rule.loader.includes('file-loader')) &&
  // (!Array.isArray(rule.use) ||
  // !rule.use.find(({loader}) => loader && loader.includes('postcss-loader')))
  // );
  // });
  // console.log('$$$ FILTERED', filteredRules);

  // return newConfig;
  // },
};
