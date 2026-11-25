import type {AggregatedResult} from '@jest/test-result';
import type {Config} from '@jest/types';
import * as Sentry from '@sentry/node';

import TestCountReporter from './testCountReporter';

const mockSpanEnd = jest.fn();

jest.mock('@sentry/node', () => ({
  close: jest.fn(() => Promise.resolve(true)),
  getGlobalScope: jest.fn(() => ({setAttributes: jest.fn()})),
  init: jest.fn(),
  isInitialized: jest.fn(() => false),
  setTags: jest.fn(),
  startInactiveSpan: jest.fn(() => ({end: mockSpanEnd})),
}));

const results = {
  startTime: 1_700_000_000_000,
  numTotalTests: 12,
  numPassedTests: 8,
  numFailedTests: 1,
  numPendingTests: 2,
  numTodoTests: 1,
  numTotalTestSuites: 3,
  numFailedTestSuites: 1,
} as AggregatedResult;

function createReporter({
  dsn = 'https://public@example.com/1',
  watch = false,
  runStartTime,
}: {dsn?: string | false; runStartTime?: number; watch?: boolean} = {}) {
  const globalConfig = {rootDir: '/repo', watch, watchAll: false} as Config.GlobalConfig;
  return new TestCountReporter(globalConfig, {
    init: {dsn: dsn || undefined, environment: 'ci:master'},
    tags: {'ci.workflow': 'frontend'},
    runStartTime,
  });
}

describe('TestCountReporter', () => {
  beforeEach(() => {
    jest.spyOn(process, 'cwd').mockReturnValue('/repo/tests/js');
    jest.spyOn(Date, 'now').mockReturnValue(results.startTime + 90_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends one jest run span with the test case counts', async () => {
    await createReporter().onRunComplete(new Set(), results);

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({environment: 'ci:master', tracesSampleRate: 1})
    );
    expect(Sentry.setTags).toHaveBeenCalledWith({'ci.workflow': 'frontend'});
    expect(Sentry.startInactiveSpan).toHaveBeenCalledTimes(1);
    expect(Sentry.startInactiveSpan).toHaveBeenCalledWith({
      op: 'jest run',
      name: 'tests/js',
      forceTransaction: true,
      startTime: results.startTime,
      attributes: {
        'test.framework': 'jest',
        'test.workspace': 'tests/js',
        'test.duration_ms': 90_000,
        'test.cases.total': 12,
        'test.cases.passed': 8,
        'test.cases.failed': 1,
        'test.cases.pending': 2,
        'test.cases.todo': 1,
        'test.suites.total': 3,
        'test.suites.failed': 1,
      },
    });
    expect(mockSpanEnd).toHaveBeenCalledTimes(1);
    expect(mockSpanEnd).toHaveBeenCalledWith(results.startTime);
    expect(Sentry.close).toHaveBeenCalledTimes(1);
  });

  it('puts the span at the shared run start time when one is given', async () => {
    const runStartTime = results.startTime - 120_000;
    await createReporter({runStartTime}).onRunComplete(new Set(), results);

    expect(Sentry.startInactiveSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: runStartTime,
        attributes: expect.objectContaining({'test.duration_ms': 90_000}),
      })
    );
    expect(mockSpanEnd).toHaveBeenCalledWith(runStartTime);
  });

  it('replaces a client that the test environment started in this process', async () => {
    jest.mocked(Sentry.isInitialized).mockReturnValueOnce(true);

    await createReporter().onRunComplete(new Set(), results);

    expect(Sentry.close).toHaveBeenCalledTimes(2);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
  });

  it('sends nothing without a DSN', async () => {
    await createReporter({dsn: false}).onRunComplete(new Set(), results);

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.startInactiveSpan).not.toHaveBeenCalled();
  });

  it('sends nothing in watch mode', async () => {
    await createReporter({watch: true}).onRunComplete(new Set(), results);

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('does not throw when reporting fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(Sentry.init).mockImplementationOnce(() => {
      throw new Error('init failed');
    });

    await expect(
      createReporter().onRunComplete(new Set(), results)
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
