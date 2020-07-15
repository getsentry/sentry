/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const config = require('../webpack.config');

config.entry = {
  sentry: config.entry.sentry,
};

module.exports = config;
