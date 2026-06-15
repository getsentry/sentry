const wrapWithStructuredClone = require('./wrapWithStructuredClone');

module.exports = wrapWithStructuredClone(require('@sentry/jest-environment/jsdom'));
