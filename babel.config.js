/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */

// NOTE: We require our plugins and presets here (as opposed to specifying them
// as strings) to allow getsentry to use this configuration. Because babel has
// it's own plugin resolution, it will not respect the NODE_PATH environment
// when loading plugins.
//
// [0]: https://github.com/babel/babel/issues/5618#issuecomment-441028871
const r = require;
const emotion = r('babel-plugin-emotion');

const config = {
  presets: [r('@babel/preset-react'), r('@babel/preset-env')],
  plugins: [
    emotion,
    r('babel-plugin-lodash'),
    r('react-hot-loader/babel'),
    r('@babel/plugin-syntax-dynamic-import'),
    r('@babel/plugin-proposal-object-rest-spread'),
    r('@babel/plugin-proposal-optional-chaining'),
    r('@babel/plugin-transform-runtime'),
    // NOTE: The order of the decorator and class-property plugins is important
    // here. Decorators must be processed first before class properties, see:
    // https://babeljs.io/docs/en/plugins#plugin-ordering
    [r('@babel/plugin-proposal-decorators'), {legacy: true}],
    [r('@babel/plugin-proposal-class-properties'), {loose: true}],
    [r('babel-plugin-transform-builtin-extend'), {globals: ['Array', 'Error']}],
  ],
  env: {
    production: {},
    development: {
      plugins: [[emotion, {sourceMap: true, autoLabel: true}]],
    },
    test: {
      plugins: [[emotion, {autoLabel: true}]],
    },
  },
};

// These plugins are only availabe in the test environment
if (process.env.NODE_ENV === 'test') {
  config.env.test.plugins.push(r('babel-plugin-dynamic-import-node'));
}

module.exports = config;
