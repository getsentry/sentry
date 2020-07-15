/* global process */
import '@visual-snapshot/jest';

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
