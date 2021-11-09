/* eslint-env node */
const createEnvironment = require('jest-sentry-environment/createEnvironment');

module.exports = createEnvironment({
  baseEnvironment: require('@visual-snapshot/jest-environment'),
});
