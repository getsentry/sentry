/* global process */
process.on('unhandledRejection', reason => {
  // eslint-disable-next-line no-console
  console.error(reason);
});
