/* global process */
import '@visual-snapshot/jest';

// The `@visual-snapshot/jest` package includes these types, but for some reason
// Google Cloud Build's `tsc` fails to include the types (GHA works as expected).
export {};

declare global {
  namespace jest {
    // eslint complains that R is unused, but we need to match interface,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R> {
      toSnapshot(): CustomMatcherResult;
    }
  }
}

process.on('unhandledRejection', reason => {
  // eslint-disable-next-line no-console
  console.error('[setupFramework] Unhandled Rejection:', reason);
});
