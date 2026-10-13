const v8 = require('node:v8');

const wrapWithStructuredClone = require('./wrapWithStructuredClone');

// Once V8 TurboFan-optimizes a hot async function shared across vm contexts
// (jest-circus's event `dispatch`), its "retained maps" keep every later test
// file's context, and the jsdom window inside it, alive through regular GCs.
// That leaks ~30MB per test file per worker. Not retaining maps lets each file's
// environment be collected once it has been torn down.
v8.setFlagsFromString('--retain-maps-for-n-gc=0');

module.exports = wrapWithStructuredClone(require('@sentry/jest-environment/jsdom'));
