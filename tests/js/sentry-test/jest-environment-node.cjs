const wrapWithStructuredClone = require('./wrapWithStructuredClone.cjs');

module.exports = wrapWithStructuredClone(require('@sentry/jest-environment/node'));
