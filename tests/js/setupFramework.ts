/* global process */
// The `@visual-snapshot/jest` package includes these types, but for some reason
// Google Cloud Build's `tsc` fails to include the types (GHA works as expected).
export {};

declare global {
  namespace jest {
    interface Matchers<R> {
      toSnapshot(): CustomMatcherResult;
    }
  }
}

process.on('unhandledRejection', reason => {
  // eslint-disable-next-line no-console
  console.error(reason);
});
