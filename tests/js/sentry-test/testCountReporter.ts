import {relative, resolve, sep} from 'node:path';

import type {AggregatedResult} from '@jest/test-result';
import type {Config} from '@jest/types';
import * as Sentry from '@sentry/node';

interface TestCountReporterOptions {
  init: Sentry.NodeOptions;
  tags: Record<string, string | number | undefined>;
}

/**
 * Sends one `jest run` span per Jest process with the test case counts from
 * Jest's aggregated results. A CI shard runs one Jest process per workspace, so
 * the per-run total is the sum of these spans across every shard of a run.
 *
 * Counting the test environment's per-test spans can't give that total
 * exactly: the count depends on how much of the span data a query reads, and a
 * run's spans spread over many minutes, so a time bucket can hold part of a run.
 */
export default class TestCountReporter {
  private readonly globalConfig: Config.GlobalConfig;
  private readonly options: TestCountReporterOptions;

  constructor(globalConfig: Config.GlobalConfig, options: TestCountReporterOptions) {
    this.globalConfig = globalConfig;
    this.options = options;
  }

  async onRunComplete(_testContexts: unknown, results: AggregatedResult) {
    const {init, tags} = this.options;
    if (!init.dsn || this.globalConfig.watch || this.globalConfig.watchAll) {
      return;
    }

    try {
      const rootDir = resolve(import.meta.dirname, '../../..');
      const workspace = relative(rootDir, process.cwd()).split(sep).join('/') || 'root';

      // A run with a single test file runs in band, where the test environment
      // already initialized Sentry in this process. Every test has finished, so
      // its client can be flushed and replaced.
      if (Sentry.isInitialized()) {
        await Sentry.close(5_000);
      }
      Sentry.init({
        ...init,
        // This process only sends the one span below, so there is nothing to
        // instrument, and sampling it would drop a shard from the per-run sum.
        defaultIntegrations: false,
        tracesSampleRate: 1,
      });
      // Streamed spans carry scope attributes instead of tags.
      Sentry.setTags(tags);
      Sentry.getGlobalScope().setAttributes(tags);

      Sentry.startInactiveSpan({
        op: 'jest run',
        name: workspace,
        forceTransaction: true,
        startTime: results.startTime,
        attributes: {
          'test.framework': 'jest',
          'test.workspace': workspace,
          'test.cases.total': results.numTotalTests,
          'test.cases.passed': results.numPassedTests,
          'test.cases.failed': results.numFailedTests,
          'test.cases.pending': results.numPendingTests,
          'test.cases.todo': results.numTodoTests,
          'test.suites.total': results.numTotalTestSuites,
          'test.suites.failed': results.numFailedTestSuites,
        },
      }).end();

      await Sentry.close(5_000);
    } catch (error) {
      // Reporting is best effort and must not change the outcome of the run.
      console.warn('Failed to report the Jest test count to Sentry', error);
    }
  }
}
