import * as Sentry from '@sentry/react';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {reportPreloadRequestMetrics} from './reportPreloadRequestMetrics';

describe('reportPreloadRequestMetrics', () => {
  beforeEach(() => {
    jest.mocked(Sentry.metrics.distribution).mockClear();
    jest.mocked(Sentry.captureException).mockClear();
  });

  it('reports the outcome of each preload request', async () => {
    window.__sentry_preload_results = {
      organization: Promise.resolve({outcome: 'success', status: 200, durationMs: 120}),
      teams: Promise.resolve({
        outcome: 'error',
        status: 401,
        error: new Error('Preload request failed with status 401 Unauthorized'),
        errorName: 'PreloadRequestError',
        durationMs: 80,
      }),
    };

    reportPreloadRequestMetrics();

    await waitFor(() => expect(Sentry.metrics.distribution).toHaveBeenCalledTimes(2));
    expect(Sentry.metrics.distribution).toHaveBeenCalledWith('ui.preload-request', 120, {
      unit: 'millisecond',
      attributes: {
        request: 'organization',
        outcome: 'success',
        status: 200,
        errorName: undefined,
      },
    });
    expect(Sentry.metrics.distribution).toHaveBeenCalledWith('ui.preload-request', 80, {
      unit: 'millisecond',
      attributes: {
        request: 'teams',
        outcome: 'error',
        status: 401,
        errorName: 'PreloadRequestError',
      },
    });
    expect(window.__sentry_preload_results).toBeUndefined();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('captures failures without an HTTP status', async () => {
    const error = new SyntaxError(
      'Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON'
    );
    window.__sentry_preload_results = {
      projects: Promise.resolve({
        outcome: 'error',
        error,
        errorName: 'SyntaxError',
        durationMs: 50,
      }),
    };

    reportPreloadRequestMetrics();

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: {preload_request: 'projects'},
      fingerprint: ['preload-request', 'SyntaxError'],
    });
    expect(Sentry.metrics.distribution).toHaveBeenCalledWith('ui.preload-request', 50, {
      unit: 'millisecond',
      attributes: {
        request: 'projects',
        outcome: 'error',
        status: undefined,
        errorName: 'SyntaxError',
      },
    });
  });

  it.each([
    'Failed to fetch',
    'Load failed',
    'NetworkError when attempting to fetch resource.',
    'Content-Length header of network response exceeds response Body.',
  ])('only reports network failures as metrics: %s', async message => {
    window.__sentry_preload_results = {
      organization: Promise.resolve({
        outcome: 'error',
        error: new TypeError(message),
        errorName: 'TypeError',
        durationMs: 700,
      }),
    };

    reportPreloadRequestMetrics();

    await waitFor(() => expect(Sentry.metrics.distribution).toHaveBeenCalledTimes(1));
    expect(Sentry.metrics.distribution).toHaveBeenCalledWith('ui.preload-request', 700, {
      unit: 'millisecond',
      attributes: {
        request: 'organization',
        outcome: 'error',
        status: undefined,
        errorName: 'TypeError',
      },
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('captures type errors that are not network failures', async () => {
    const error = new TypeError('window.__initialData.initialTrace is undefined');
    window.__sentry_preload_results = {
      teams: Promise.resolve({
        outcome: 'error',
        error,
        errorName: 'TypeError',
        durationMs: 1,
      }),
    };

    reportPreloadRequestMetrics();

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: {preload_request: 'teams'},
      fingerprint: ['preload-request', 'TypeError'],
    });
  });

  it('does nothing without preload results', () => {
    window.__sentry_preload_results = undefined;
    reportPreloadRequestMetrics();
    expect(Sentry.metrics.distribution).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
