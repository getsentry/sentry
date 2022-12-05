/* eslint-env node */
const createEnvironment = require('@sentry/jest-environment/createEnvironment');

module.exports = createEnvironment({
  baseEnvironment: require('@visual-snapshot/jest-environment'),
});
