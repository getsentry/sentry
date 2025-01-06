/* eslint-env node */
import type {Span} from '@sentry/core';
import type * as Sentry from '@sentry/node';
import crypto from 'node:crypto';
import https from 'node:https';
import os from 'node:os';
import type webpack from 'webpack';

const {
  NODE_ENV,
  SENTRY_INSTRUMENTATION,
  SENTRY_WEBPACK_WEBHOOK_SECRET,
  GITHUB_SHA,
  GITHUB_REF,
  SENTRY_DEV_UI_PROFILING,
} = process.env;

const IS_CI = !!GITHUB_SHA;

const PLUGIN_NAME = 'SentryInstrumentation';
const GB_BYTE = 1073741824;

const createSignature = function (secret: string, payload: string) {
  const hmac = crypto.createHmac('sha1', secret);
  return `sha1=${hmac.update(payload).digest('hex')}`;
};

const INCREMENTAL_BUILD_TXN = 'incremental-build';
const INITIAL_BUILD_TXN = 'initial-build';

class SentryInstrumentation {
  hasInitializedBuild: boolean = false;

  Sentry?: typeof Sentry;

  span?: Span;

  constructor() {
    // Only run if SENTRY_INSTRUMENTATION` is set or when in ci,
    // only in the javascript suite that runs webpack
    if (!SENTRY_INSTRUMENTATION && !SENTRY_DEV_UI_PROFILING) {
      return;
    }

    const sentry = require('@sentry/node') as typeof Sentry;
    const {nodeProfilingIntegration} = require('@sentry/profiling-node');

    sentry.init({
      dsn: 'https://3d282d186d924374800aa47006227ce9@sentry.io/2053674',
      environment: IS_CI ? 'ci' : 'local',
      tracesSampleRate: 1.0,
      integrations: [nodeProfilingIntegration()],
      profilesSampler: ({transactionContext}) => {
        if (transactionContext.name === INCREMENTAL_BUILD_TXN) {
          return 0;
        }
        return 1;
      },
      _experiments: {
        // 5 minutes should be plenty
        maxProfileDurationMs: 5 * 60 * 1000,
      },
    });

    if (IS_CI) {
      sentry.setTag('branch', GITHUB_REF);
    }

    const cpus = os.cpus();
    sentry.setTag('platform', os.platform());
    sentry.setTag('arch', os.arch());
    sentry.setTag(
      'cpu',
      cpus?.length ? `${cpus[0]!.model} (cores: ${cpus.length})}` : 'N/A'
    );

    this.Sentry = sentry;

    this.span = sentry.startInactiveSpan({
      op: 'webpack-build',
      name: INITIAL_BUILD_TXN,
    });
  }

  /**
   * Measures the file sizes of assets emitted from the entrypoints
   */
  measureAssetSizes(compilation: webpack.Compilation) {
    if (!SENTRY_WEBPACK_WEBHOOK_SECRET) {
      return;
    }

    [...compilation.entrypoints].forEach(([entrypointName, entry]) =>
      entry.chunks.forEach(chunk =>
        Array.from(chunk.files)
          .filter(assetName => !assetName.endsWith('.map'))
          .forEach(assetName => {
            const asset = compilation.assets[assetName];
            const size = asset!.size();
            const file = assetName;
            const body = JSON.stringify({
              file,
              entrypointName,
              size,
              commit: GITHUB_SHA,
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

  measureBuildTime(startTime: number, endTime: number) {
    if (!this.Sentry) {
      return;
    }

    const span = !this.hasInitializedBuild
      ? this.span
      : this.Sentry.startInactiveSpan({
          op: 'webpack-build',
          name: INCREMENTAL_BUILD_TXN,
          startTime,
        });

    if (!span) {
      return;
    }

    this.Sentry.withActiveSpan(span, () => {
      this.Sentry?.startInactiveSpan({
        op: 'build',
        name: 'webpack build',
        attributes: {
          os: `${os.platform()} ${os.arch()} v${os.release()}`,
          memory: os.freemem()
            ? `${os.freemem() / GB_BYTE} / ${os.totalmem() / GB_BYTE} GB (${
                (os.freemem() / os.totalmem()) * 100
              }% free)`
            : 'N/A',
          loadavg: os.loadavg(),
        },
        startTime,
      }).end(endTime);
    });

    span.end();
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.done.tapAsync(
      PLUGIN_NAME,
      async ({compilation, startTime, endTime}, done) => {
        // Only record this once and only on Travis
        // Don't really care about asset sizes during local dev
        if (IS_CI && !this.hasInitializedBuild) {
          this.measureAssetSizes(compilation);
        }

        if (this.Sentry) {
          this.measureBuildTime(startTime / 1000, endTime / 1000);
          await this.Sentry.flush();
        }

        this.hasInitializedBuild = true;

        done();
      }
    );
  }
}

export default SentryInstrumentation;
