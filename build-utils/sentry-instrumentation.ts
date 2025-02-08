import type {Span} from '@sentry/core';
import os from 'node:os';
import type webpack from 'webpack';

const {SENTRY_INSTRUMENTATION, GITHUB_SHA, GITHUB_REF} = process.env;

const IS_CI = !!GITHUB_SHA;

const PLUGIN_NAME = 'SentryInstrumentation';
const GB_BYTE = 1073741824;
class SentryInstrumentation {
  Sentry = require('@sentry/node');

  hasInitializedBuild: boolean = false;
  spans: Record<string, Span> = {};

  constructor() {
    // Only run if SENTRY_INSTRUMENTATION` is set or when in ci,
    // only in the javascript suite that runs webpack
    if (!SENTRY_INSTRUMENTATION) {
      return;
    }

    this.Sentry.init({
      dsn: 'https://3d282d186d924374800aa47006227ce9@sentry.io/2053674',
      environment: IS_CI ? 'ci' : 'local',
      tracesSampleRate: 1.0,
    });

    this.withCITags();
    this.withOSPlatformTags();

    this.spans['initial-build'] = this.Sentry.startInactiveSpan({
      op: 'webpack-build',
      name: 'initial-build',
    });
  }

  withCITags() {
    if (IS_CI) {
      this.Sentry.setTag('branch', GITHUB_REF);
    }
  }

  withOSPlatformTags() {
    this.Sentry.setTag('platform', os.platform());
    this.Sentry.setTag('arch', os.arch());

    const cpus = os.cpus();
    this.Sentry.setTag(
      'cpu',
      cpus?.length ? `${cpus[0]!.model} (cores: ${cpus.length})}` : 'N/A'
    );
  }

  measureInitialBuildTime(startTime: number, endTime: number) {
    const initialBuildSpan = this.spans['initial-build'];

    if (!initialBuildSpan) {
      return;
    }

    const that = this;
    this.Sentry.withActiveSpan(initialBuildSpan, () => {
      that.Sentry.startInactiveSpan({
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

    initialBuildSpan.end();
    delete this.spans['initial-build'];
    this.hasInitializedBuild = true;
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.done.tapAsync(PLUGIN_NAME, async ({startTime, endTime}, done) => {
      this.measureInitialBuildTime(startTime / 1000, endTime / 1000);

      await this.Sentry.flush();
      done();
    });
  }
}

export default SentryInstrumentation;
