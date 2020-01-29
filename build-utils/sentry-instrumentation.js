/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */

class SentryInstrumentation {
  constructor() {
    // Only run if SENTRY_INSTRUMENTATION` is set or when in travis, only in the javascript suite
    if (process.env.SENTRY_INSTRUMENTATION || process.env.TEST_SUITE === 'js') {
      this.Sentry = require('@sentry/node');
      require('@sentry/apm');

      this.Sentry.init({
        dsn: 'https://1e77769d661c4caab572f453e631362e@sentry.io/1853222',
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

      this.Sentry.setTag('travis_branch', process.env.TRAVIS_BRANCH);
      this.Sentry.setTag('travis_build_url', process.env.TRAVIS_BUILD_WEB_URL);
      this.Sentry.setTag('travis_commit', process.env.TRAVIS_COMMIT);

      const hub = this.Sentry.getCurrentHub();

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

              hub.configureScope(scope => scope.setSpan(transaction));

              let start = transaction.startTimestamp;

              const span = this.Sentry.getCurrentHub().startSpan({
                op: 'asset',
                description: assetName,
                data: {},
                sampled: true,
              });
              span.startTimestamp = start;
              span.finish();
              span.timestamp = start + sizeInKb / 1000 / 100;
              start = span.timestamp;
              transaction.setHttpStatus(200);
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
