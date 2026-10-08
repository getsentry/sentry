const v8 = require('node:v8');
const vm = require('node:vm');

const withTagsAsSpanAttributes = require('./withTagsAsSpanAttributes');
const wrapWithStructuredClone = require('./wrapWithStructuredClone');

// Once V8 TurboFan-optimizes a hot async function shared across vm contexts
// (jest-circus's event `dispatch`), its "retained maps" keep every later test
// file's context, and the jsdom window inside it, alive through regular GCs.
// That leaks ~30MB per test file per worker. Not retaining maps lets each file's
// environment be collected once it has been torn down.
v8.setFlagsFromString('--retain-maps-for-n-gc=0');

// Borrow V8's gc() without exposing a `gc` global to test files.
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc');
v8.setFlagsFromString('--no-expose-gc');

// V8 rarely runs a full GC on a large heap, so finished test files pile up and
// the eventual multi-second pause times out whichever test is running. A GC
// between test files keeps the heap small, and its pause can't land in a test.
const GC_ABOVE_HEAP_BYTES = 512 * 1024 * 1024;

const SentryEnvironment = withTagsAsSpanAttributes(
  wrapWithStructuredClone(require('@sentry/jest-environment/jsdom'))
);

module.exports = class SentryTestEnvironment extends SentryEnvironment {
  async teardown() {
    await super.teardown();
    if (v8.getHeapStatistics().used_heap_size > GC_ABOVE_HEAP_BYTES) {
      gc();
    }
  }
};
