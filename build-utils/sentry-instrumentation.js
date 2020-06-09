/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const os = require('os');
const http = require('http');

const {
  SENTRY_INSTRUMENTATION,
  TEST_SUITE,
  TRAVIS_COMMIT,
  TRAVIS_BRANCH,
  TRAVIS_PULL_REQUEST,
  TRAVIS_PULL_REQUEST_BRANCH,
} = process.env;
const IS_TRAVIS = !!TRAVIS_COMMIT;

const PLUGIN_NAME = 'SentryInstrumentation';
const GB_BYTE = 1073741824;

class SentryInstrumentation {
  constructor() {
    // Only run if SENTRY_INSTRUMENTATION` is set or when in travis, only in the javascript suite that runs webpack
    if (!SENTRY_INSTRUMENTATION && TEST_SUITE !== 'js-build') {
      return;
    }

    this.initialBuild = false;
    this.Sentry = require('@sentry/node');
    require('@sentry/apm'); // This is required to patch Sentry

    this.Sentry.init({
      dsn: 'https://3d282d186d924374800aa47006227ce9@sentry.io/2053674',
      environment: IS_TRAVIS ? 'travis' : 'local',
      tracesSampleRate: 1.0,
    });

    if (IS_TRAVIS) {
      this.Sentry.setTag('branch', TRAVIS_PULL_REQUEST_BRANCH || TRAVIS_BRANCH);
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
   * Measures the file sizes of assets emitted from the entrypoints
   */
  measureAssetSizes(compilation) {
    console.log('measure asset sizes');
    [...compilation.entrypoints].forEach(([entrypointName, entry]) =>
      entry.chunks.forEach(chunk =>
        chunk.files
          .filter(assetName => !assetName.endsWith('.map'))
          .forEach(assetName => {
            const asset = compilation.assets[assetName];
            const size = asset.size();
            const file = assetName;
            const body = JSON.stringify({
              file,
              entrypointName,
              size,
            });
            console.log(body);
            const req = http.request({
              host: 'bv.ngrok.io',
              path: '/metrics/webpack/webhook',
              port: 80,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
              },
            });
            req.end(body);
            // post somewhere
          })
      )
    );
  }

  measureBuildTime(startTime, endTime) {
    if (!this.Sentry) {
      return;
    }

    const transaction = this.Sentry.startTransaction({
      op: 'webpack-build',
      name: !this.initialBuild ? 'initial-build' : 'incremental-build',
      description: 'webpack build times',
      startTimestamp: startTime,
      trimEnd: true,
    });

    const span = transaction.startChild({
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
      startTimestamp: startTime,
    });
    span.finish(endTime);
    transaction.finish();
  }

  apply(compiler) {
    compiler.hooks.done.tapAsync(
      PLUGIN_NAME,
      async ({compilation, startTime, endTime}, done) => {
        if (!this.Sentry) {
          done();
          return;
        }
        this.measureBuildTime(startTime / 1000, endTime / 1000);

        // Only record this once and only on Travis
        // Don't really care about asset sizes during local dev
        // if (!IS_TRAVIS && !this.initialBuild) {
        if (!this.initialBuild) {
          this.measureAssetSizes(compilation);
        }

        this.initialBuild = true;
        await this.Sentry.flush();
        done();
      }
    );
  }
}
module.exports = SentryInstrumentation;
