import type {ReactNode} from 'react';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useLogsAggregatesTable} from 'sentry/views/explore/logs/useLogsAggregatesTable';

function Wrapper({children}: {children: ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
      source="location"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

describe('useLogsAggregatesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers the high accuracy request when there is no data and a partial scan', async () => {
    const mockNormalRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
        meta: {
          dataScanned: 'partial',
          fields: {},
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.NORMAL;
        },
      ],
    });

    const mockHighAccuracyRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [],
        meta: {
          dataScanned: 'full',
          fields: {},
        },
      },
      method: 'GET',
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.query.sampling === SAMPLING_MODE.HIGH_ACCURACY;
        },
      ],
    });

    renderHookWithProviders(useLogsAggregatesTable, {
      additionalWrapper: Wrapper,
      initialProps: {
        enabled: true,
        limit: 100,
      },
    });

    expect(mockNormalRequest).toHaveBeenCalledTimes(1);
    expect(mockNormalRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'ourlogs',
          sampling: SAMPLING_MODE.NORMAL,
        }),
      })
    );

    await waitFor(() => expect(mockHighAccuracyRequest).toHaveBeenCalledTimes(1));
    expect(mockHighAccuracyRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'ourlogs',
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
        }),
      })
    );
  });
});
