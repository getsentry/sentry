import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
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
  {yAxes: ['count(message)'], transformations: ['smooth(sma,3)']},
  {yAxes: ['count(message)'], transformations: ['fill(zero)']},
].map(field => JSON.stringify(field));

describe('useLogsTimeseriesRequest', () => {
  beforeEach(() => {
    PageFiltersStore.reset();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  it.each([false, true])(
    'deduplicates pipelines and adds a raw count with the feature enabled=%s',
    enabled => {
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
        enabled ? [['fill(zero)'], ['smooth(sma,3)'], []] : undefined
      );
    }
  );

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
});
