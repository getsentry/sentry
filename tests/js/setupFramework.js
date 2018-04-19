/* global process */
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error(reason);
});
