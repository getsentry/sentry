import type {ReactNode} from 'react';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {LOGS_AGGREGATE_FIELD_KEY} from 'sentry/views/explore/logs/logsQueryParams';
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

  it('skips the request and surfaces an error when every series filter is invalid', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [], meta: {fields: {}}},
      method: 'GET',
    });

    const {result} = renderHookWithProviders(
      () =>
        useLogsAggregatesTable({
          enabled: true,
          limit: 100,
        }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/explore/logs/',
            query: {
              [LOGS_AGGREGATE_FIELD_KEY]: [
                JSON.stringify({groupBy: ''}),
                JSON.stringify({yAxes: ['count_if(``,message)']}),
              ],
            },
          },
        },
      }
    );

    expect(mockRequest).not.toHaveBeenCalled();
    expect(result.current.isError).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error?.message).toEqual(expect.any(String));
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

    renderHookWithProviders(
      () =>
        useLogsAggregatesTable({
          enabled: true,
          limit: 100,
        }),
      {additionalWrapper: Wrapper}
    );

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
