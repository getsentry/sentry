/* eslint-env node */
import type * as Sentry from '@sentry/node';
import type {Span} from '@sentry/types';
import crypto from 'node:crypto';
import https from 'node:https';
import os from 'node:os';
import type webpack from 'webpack';

const {NODE_ENV, SENTRY_WEBPACK_WEBHOOK_SECRET, GITHUB_SHA, GITHUB_REF} = process.env;

const IS_CI = !!GITHUB_SHA;

const PLUGIN_NAME = 'SentryInstrumentation';
const GB_BYTE = 1073741824;

const createSignature = function (secret: string, payload: string) {
  const hmac = crypto.createHmac('sha1', secret);
  return `sha1=${hmac.update(payload).digest('hex')}`;
};

class SentryInstrumentation {
  hasInitializedBuild: boolean = false;
  Sentry?: typeof Sentry;
  span?: Span;

  constructor() {
    this.Sentry = require('@sentry/node') as typeof Sentry;
    const {nodeProfilingIntegration} = require('@sentry/profiling-node');
    // @ts-ignore
    // eslint-disable-next-line
    let profiler_id: string | undefined;

    this.Sentry.init({
      dsn: 'https://07898f7cdd56ebabb2761c0fb54578a1@o87286.ingest.us.sentry.io/4507936144031744',
      environment: IS_CI ? 'ci' : 'local',
      tracesSampleRate: 1.0,
      debug: true,
      integrations: [nodeProfilingIntegration()],
      beforeSendTransaction(transaction) {
        //  @ts-ignore
        transaction.contexts.profile = {};
        //  @ts-ignore
        transaction.contexts.profile = {profiler_id};
        return transaction;
      },
    });

    const profilingIntegration =
      this.Sentry.getClient()?.getIntegrationByName('ProfilingIntegration');
    // @ts-ignore
    // eslint-disable-next-line
    profiler_id = profilingIntegration._profiler._profilerId;

    this.Sentry.profiler.startProfiler();

    if (IS_CI) {
      this.Sentry.setTag('branch', GITHUB_REF);
    }

    const cpus = os.cpus();
    this.Sentry.setTag('platform', os.platform());
    this.Sentry.setTag('arch', os.arch());
    this.Sentry.setTag(
      'cpu',
      cpus?.length ? `${cpus[0].model} (cores: ${cpus.length})}` : 'N/A'
    );

    this.span = this.Sentry.startInactiveSpan({
      op: 'webpack-build',
      name: 'initial-build',
      forceTransaction: true,
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
            const size = asset.size();
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
          name: 'incremental-build',
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
          // @ts-ignore
          // eslint-disable-next-line
          console.log(this.Sentry.getGlobalScope());
          this.Sentry.profiler.stopProfiler();
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
