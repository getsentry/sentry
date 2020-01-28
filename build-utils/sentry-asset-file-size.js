/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
class SentryAssetFileSize {
  constructor() {
    if (!!process.env.SENTRY_MEASURE_WEBPACK_DSN) {
      this.Sentry = require('@sentry/node');
      require('@sentry/apm');

      this.Sentry.init({
        dsn: process.env.SENTRY_MEASURE_WEBPACK_DSN,
      });
    }
  }

  apply(compiler) {
    compiler.hooks.done.tapAsync('SentryAssetFileSize', async ({compilation}, done) => {
      if (!this.Sentry) {
        done();
        return;
      }

      const hub = this.Sentry.getCurrentHub();
      const transaction = hub.startSpan({
        op: 'webpack-bundle-size',
        transaction: 'webpack-bundle-size',
        description: 'webpack bundle sizes for all entry points',
        data: {},
        sampled: true,
      });

      hub.configureScope(scope => scope.setSpan(transaction));

      let start = transaction.startTimestamp;

      [...compilation.entrypoints].forEach(([, entry]) =>
        entry.chunks.forEach(chunk =>
          chunk.files.forEach(assetName => {
            const asset = compilation.assets[assetName];

            const sizeInKb = asset.size() / 1024;
            const span = this.Sentry.getCurrentHub().startSpan({
              op: 'asset',
              description: assetName,
              data: {
                size: `${Math.round(sizeInKb)}KB`,
              },
              sampled: true,
            });
            span.startTimestamp = start;
            span.setHttpStatus(200);
            span.finish();
            span.timestamp = start + sizeInKb / 1000;
            start = span.timestamp;
          })
        )
      );

      transaction.setHttpStatus(200);
      transaction.finish(true);

      const client = this.Sentry.getCurrentHub().getClient();
      if (client) {
        await client.close();
      }

      done();
    });
  }
}
module.exports = SentryAssetFileSize;
