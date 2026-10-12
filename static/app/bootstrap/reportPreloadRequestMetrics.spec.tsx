import * as Sentry from '@sentry/react';

import {waitFor} from 'sentry-test/reactTestingLibrary';

import {reportPreloadRequestMetrics} from './reportPreloadRequestMetrics';

describe('reportPreloadRequestMetrics', () => {
  beforeEach(() => {
    jest.mocked(Sentry.metrics.distribution).mockClear();
  });

  it('reports the outcome of each preload request', async () => {
    window.__sentry_preload_results = {
      organization: Promise.resolve({outcome: 'success', status: 200, durationMs: 120}),
      teams: Promise.resolve({
        outcome: 'error',
        status: 401,
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
  });

  it('does nothing without preload results', () => {
    window.__sentry_preload_results = undefined;
    reportPreloadRequestMetrics();
    expect(Sentry.metrics.distribution).not.toHaveBeenCalled();
  });
});
