const withTagsAsSpanAttributes = require('./withTagsAsSpanAttributes');
const wrapWithStructuredClone = require('./wrapWithStructuredClone');

module.exports = withTagsAsSpanAttributes(
  wrapWithStructuredClone(require('@sentry/jest-environment/node'))
);
