/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const os = require('os');

const {
  SENTRY_INSTRUMENTATION,
  TEST_SUITE,
  TRAVIS_COMMIT,
  TRAVIS_BRANCH,
  TRAVIS_PULL_REQUEST,
  TRAVIS_PULL_REQUEST_BRANCH,
  TRAVIS_PULL_REQUEST_SHA,
} = process.env;
const IS_TRAVIS = !!TRAVIS_COMMIT;

const PLUGIN_NAME = 'SentryInstrumentation';
const GB_BYTE = 1073741824;

class SentryInstrumentation {
  constructor() {
    // Only run if SENTRY_INSTRUMENTATION` is set or when in travis, only in the javascript suite
    if (!SENTRY_INSTRUMENTATION && TEST_SUITE !== 'js') {
      return;
    }

    this.initialBuild = false;
    this.Sentry = require('@sentry/node');
    require('@sentry/apm');

    this.Sentry.init({
      dsn: 'https://3d282d186d924374800aa47006227ce9@sentry.io/2053674',
      environment: IS_TRAVIS ? 'travis' : 'local',
    });

    if (!IS_TRAVIS) {
      this.Sentry.setUser({
        username: require('os').userInfo().username,
      });
    } else {
      this.Sentry.setTag('branch', TRAVIS_PULL_REQUEST_BRANCH || TRAVIS_BRANCH);
      this.Sentry.setTag('commit', TRAVIS_PULL_REQUEST_SHA || TRAVIS_COMMIT);
      this.Sentry.setTag('pull_request', TRAVIS_PULL_REQUEST);
    }

    const cpus = os.cpus();
    this.Sentry.setTag('platform', os.platform());
    this.Sentry.setTag('arch', os.arch());
    this.Sentry.setTag(
      'cpu',
      cpus && cpus.length ? `${cpus[0].model} (cores: ${cpus.length})}` : 'N/A'
    );
  }

  /**
   * Waits for Sentry SDK to finish requests
   */
  async sdkFinish() {
    const client = this.Sentry.getCurrentHub().getClient();
    if (client) {
      await client.flush();
    }
  }

  /**
   * Measures the file sizes of assets emitted from the entrypoints
   */
  measureAssetSizes(compilation) {
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

            const start = transaction.startTimestamp;

            hub.configureScope(scope => scope.setSpan(transaction));

            const span = hub.startSpan({
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
  }

  measureBuildTime(startTime, endTime) {
    if (!this.Sentry) {
      return;
    }

    const hub = this.Sentry.getCurrentHub();

    const transaction = hub.startSpan(
      {
        op: 'webpack-build',
        transaction: !this.initialBuild ? 'initial-build' : 'incremental-build',
        description: 'webpack build times',
        sampled: true,
      },
      true
    );
    transaction.startTimestamp = startTime;

    hub.getScope().setSpan(transaction);

    const span = transaction.child({
      op: 'build',
      description: 'webpack build',
      data: {
        os: `${os.platform()} ${os.arch()} v${os.release()}`,
        memory: os.freemem()
          ? `${os.freemem() / GB_BYTE} / ${os.totalmem() / GB_BYTE} GB (${(os.freemem() /
              os.totalmem()) *
              100}% free)`
          : 'N/A',
        loadavg: os.loadavg(),
      },
      sampled: true,
    });
    span.startTimestamp = startTime;
    span.finish();
    span.timestamp = endTime;

    transaction.finish(true);
  }

  apply(compiler) {
    compiler.hooks.done.tapAsync(
      PLUGIN_NAME,
      async ({compilation, startTime, endTime}, done) => {
        if (!this.Sentry) {
          done();
          return;
        }
        this.Sentry.setTag('webpack-hash', compilation.hash);

        this.measureBuildTime(startTime / 1000, endTime / 1000);

        // Only record this once and only on Travis
        // Don't really care about asset sizes during local dev
        if (!IS_TRAVIS && !this.initialBuild) {
          this.measureAssetSizes(compilation);
        }

        this.initialBuild = true;
        await this.sdkFinish();
        done();
      }
    );
  }
}
module.exports = SentryInstrumentation;
