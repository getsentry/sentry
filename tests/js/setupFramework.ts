/* global process */
import '@visual-snapshot/jest';

process.on('unhandledRejection', reason => {
  // eslint-disable-next-line no-console
  console.error(reason);
});
