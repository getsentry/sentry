/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const config = require('../webpack.config');

config.entry = {
  sentry: 'less/jest-ci.less',
};

module.exports = config;
