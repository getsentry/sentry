/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const crypto = require('crypto');
const https = require('https');
const os = require('os');

const {
  NODE_ENV,
  SENTRY_INSTRUMENTATION,
  SENTRY_WEBPACK_WEBHOOK_SECRET,
  TRAVIS_COMMIT,
  TRAVIS_BRANCH,
  TRAVIS_PULL_REQUEST,
  TRAVIS_PULL_REQUEST_BRANCH,
} = process.env;
const IS_CI = !!TRAVIS_COMMIT;

const PLUGIN_NAME = 'SentryInstrumentation';
const GB_BYTE = 1073741824;

const createSignature = function(secret, payload) {
  const hmac = crypto.createHmac('sha1', secret);
  return `sha1=${hmac.update(payload).digest('hex')}`;
};

class SentryInstrumentation {
  constructor() {
    // Only run if SENTRY_INSTRUMENTATION` is set or when in travis, only in the javascript suite that runs webpack
    if (!SENTRY_INSTRUMENTATION) {
      return;
    }

    this.initialBuild = false;
    this.Sentry = require('@sentry/node');
    require('@sentry/tracing'); // This is required to patch Sentry

    this.Sentry.init({
      dsn: 'https://3d282d186d924374800aa47006227ce9@sentry.io/2053674',
      environment: IS_CI ? 'ci' : 'local',
      tracesSampleRate: 1.0,
    });

    if (IS_CI) {
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
    if (!SENTRY_WEBPACK_WEBHOOK_SECRET) {
      return;
    }

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
              commit: TRAVIS_COMMIT,
              pull_request_number: TRAVIS_PULL_REQUEST,
              environment: IS_CI ? 'ci' : '',
              node_env: NODE_ENV,
            });

            const req = https.request({
              host: 'product-eng-webhooks-vmrqv3f7nq-uw.a.run.app',
              path: '/metrics/webpack/webhook',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-webpack-signature': createSignature(
                  SENTRY_WEBPACK_WEBHOOK_SECRET,
                  body
                ),
              },
            });
            req.end(body);
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
        // Only record this once and only on Travis
        // Don't really care about asset sizes during local dev
        if (IS_CI && !this.initialBuild) {
          this.measureAssetSizes(compilation);
        }

        if (this.Sentry) {
          this.measureBuildTime(startTime / 1000, endTime / 1000);
          await this.Sentry.flush();
        }

        this.initialBuild = true;

        done();
      }
    );
  }
}
module.exports = SentryInstrumentation;
