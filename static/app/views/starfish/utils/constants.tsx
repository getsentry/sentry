export const HOST = 'http://localhost:8080';

// Span ops from Sentry Docs, but with 'cache' added:
// https://develop.sentry.dev/sdk/performance/span-operations/#currently-used-categories
export const ACCEPTED_SPAN_OPS = [
  'mark',
  'pageload',
  'navigation',
  'resource',
  'browser',
  'measure',
  'ui',
  'app',
  'http',
  'websocket',
  'rpc',
  'grpc',
  'graphql',
  'subprocess',
  'middleware',
  'view',
  'template',
  'serialize',
  'console',
  'db',
  'file',
  'function',
  'topic',
  'queue',
  'cache',
];
