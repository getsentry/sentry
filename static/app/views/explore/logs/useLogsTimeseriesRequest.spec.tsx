import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {useLogsExportEstimatedRowCount} from 'sentry/views/explore/logs/exports/useLogsExportEstimatedRowCount';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {useLogsTimeseriesRequest} from 'sentry/views/explore/logs/useLogsTimeseriesRequest';

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

const aggregateFields = [
  {yAxes: ['count(message)'], transformations: ['fill(zero)']},
  {yAxes: ['count_if(`avg(payload_size):>100`,message)']},
  {yAxes: ['count(message)'], transformations: ['moving_average(3)']},
  {yAxes: ['count(message)'], transformations: ['fill(zero)']},
].map(field => JSON.stringify(field));

describe('useLogsTimeseriesRequest', () => {
  beforeEach(() => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it.each([false, true])('finalizes paired queries with the flag %s', enabled => {
    const {result} = renderHookWithProviders(
      () => useLogsTimeseriesRequest({enabled: true, timeseriesIngestDelay: 0n}),
      {
        organization: OrganizationFixture({
          features: enabled ? ['explore-interpolation-and-smoothing'] : [],
        }),
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {pathname: '/', query: {aggregateField: aggregateFields}},
        },
      }
    );

    expect(result.current.enabled).toBe(true);
    expect(result.current.yAxis).toEqual(
      enabled
        ? ['count(message)', 'count(message)', 'count(message)']
        : ['count(message)']
    );
    expect(result.current.transformations).toEqual(
      enabled ? [['fill(zero)'], ['moving_average(3)'], []] : undefined
    );
  });

  it('requests raw overrides independently of visible transformations', () => {
    const {result} = renderHookWithProviders(
      () =>
        useLogsTimeseriesRequest({
          enabled: true,
          timeseriesIngestDelay: 0n,
          yAxesOverride: ['count(message)'],
        }),
      {
        organization: OrganizationFixture({
          features: ['explore-interpolation-and-smoothing'],
        }),
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {pathname: '/', query: {aggregateField: aggregateFields}},
        },
      }
    );

    expect(result.current.yAxis).toEqual(['count(message)']);
    expect(result.current.transformations).toEqual([[]]);
  });

  it('estimates export rows using the raw count despite transformed visible charts', async () => {
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'count(message)',
            meta: {valueType: 'integer', valueUnit: null, interval: 1000},
            values: [{timestamp: 1000, value: 234, sampleCount: 234}],
          },
        ],
      },
    });
    const {result} = renderHookWithProviders(
      () => useLogsExportEstimatedRowCount(1, 0n),
      {
        organization: OrganizationFixture({
          features: ['explore-interpolation-and-smoothing'],
        }),
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {pathname: '/', query: {aggregateField: aggregateFields}},
        },
      }
    );

    await waitFor(() => expect(result.current).toBe(234));
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/events-timeseries/',
      expect.objectContaining({
        query: expect.objectContaining({yAxis: ['count(message)']}),
      })
    );
    expect(request.mock.calls[0]?.[1].query).not.toHaveProperty('transformations[0]');
  });
});
