const {wrapWithStructuredClone} = require('./jest-environment');

module.exports = wrapWithStructuredClone(require('@sentry/jest-environment/node'));
