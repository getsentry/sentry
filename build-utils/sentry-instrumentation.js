/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */

const IS_TRAVIS = process.env.TRAVIS_COMMIT;

class SentryInstrumentation {
  constructor() {
    // Only run if SENTRY_INSTRUMENTATION` is set or when in travis, only in the javascript suite
    if (process.env.SENTRY_INSTRUMENTATION || process.env.TEST_SUITE === 'js') {
      this.Sentry = require('@sentry/node');
      require('@sentry/apm');

      this.Sentry.init({
        dsn: 'https://3d282d186d924374800aa47006227ce9@sentry.io/2053674',
        environment: process.env.TRAVIS_BRANCH ? 'travis' : 'local',
      });
    }
  }

  apply(compiler) {
    compiler.hooks.done.tapAsync('SentryInstrumentation', async ({compilation}, done) => {
      if (!this.Sentry) {
        done();
        return;
      }

      if (IS_TRAVIS) {
        this.Sentry.setTag('travis_branch', process.env.TRAVIS_BRANCH);
        this.Sentry.setTag('travis_commit', process.env.TRAVIS_COMMIT);
      }

      const hub = this.Sentry.getCurrentHub();

      this.Sentry.setTag('webpack-hash', compilation.hash);

      [...compilation.entrypoints].forEach(([entrypointName, entry]) =>
        entry.chunks.forEach(chunk =>
          chunk.files
            .filter(assetName => !assetName.endsWith('.map'))
            .forEach(assetName => {
              const asset = compilation.assets[assetName];
              const sizeInKb = asset.size() / 1024;

              const transaction = hub.startSpan({
                op: 'webpack-asset',
                transaction: assetName,
                description: `webpack bundle size for ${entrypointName} -> ${assetName}`,
                data: {
                  entrypointName,
                  file: assetName,
                  size: `${Math.round(sizeInKb)} KB`,
                },
                sampled: true,
              });

              const start = transaction.startTimestamp;

              hub.configureScope(scope => scope.setSpan(transaction));

              const span = this.Sentry.getCurrentHub().startSpan({
                op: 'asset',
                startTimestamp: start,
                description: assetName,
                data: {
                  entrypointName,
                  file: assetName,
                  size: `${Math.round(sizeInKb)} KB`,
                },
                sampled: true,
              });
              span.startTimestamp = start;
              span.finish();
              span.timestamp = start + sizeInKb / 1000;
              transaction.finish(true);
            })
        )
      );

      const client = this.Sentry.getCurrentHub().getClient();
      if (client) {
        await client.close();
      }

      done();
    });
  }
}
module.exports = SentryInstrumentation;
