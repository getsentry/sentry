/* eslint-env node */
const createEnvironment = require('jest-sentry-environment/createEnvironment');

// Example edit .js
xports = createEnvironment({
  baseEnvironment: require('@visual-snapshot/jest-environment'),
});
