import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import {useQueries, type UseQueryResult} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {convertEventStatsRequestDataToEventTimeseriesQueryParams} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {shouldUseEventsTimeseries} from 'sentry/views/dashboards/utils/shouldUseEventsTimeseries';
import {findSeriesDifferences} from 'sentry/views/dashboards/widgetCard/hooks/utils/findSeriesDifferences';
import {getTimeseriesWidgetQueryOptions} from 'sentry/views/dashboards/widgetCard/hooks/utils/getTimeseriesWidgetQueryOptions';

const {warn} = Sentry.logger;
const SAMPLE_RATE = 0.1;

type SpotCheckQuery = {
  // Same request the widget would send to `/events-timeseries/`
  params: ReturnType<typeof convertEventStatsRequestDataToEventTimeseriesQueryParams>;
  // Query used to transform both responses into series
  widgetQuery: WidgetQuery;
};

function isSettled(result: UseQueryResult | undefined) {
  return !!result?.data && !result.isFetching && !result.isPlaceholderData;
}

/**
 * When sampled, fetches `/events-timeseries/` and logs any differences from `/events-stats/`.
 */
export function useEventsTimeseriesSpotCheck({
  config,
  enabled,
  statsQueryResults,
  organization,
  pageFilters,
  timeSeriesQueries,
  widget,
}: {
  config: Pick<DatasetConfig<any, any>, 'transformSeries'>;
  enabled: boolean;
  organization: Organization;
  pageFilters: PageFilters;
  statsQueryResults: Array<UseQueryResult<any>>;
  timeSeriesQueries: Array<SpotCheckQuery | undefined>;
  widget: Widget;
}) {
  const [isSampled] = useState(() => Math.random() < SAMPLE_RATE);
  const isSpotCheckEnabled =
    enabled &&
    isSampled &&
    !shouldUseEventsTimeseries(organization) &&
    organization.features.includes('dashboards-widgets-events-timeseries-spot-check');

  const activeTimeSeriesQueries = timeSeriesQueries.flatMap(
    (query, originalQueryIndex) => (query ? [{...query, originalQueryIndex}] : [])
  );

  const timeSeriesQueryResults = useQueries({
    queries: activeTimeSeriesQueries.map(({params}) =>
      getTimeseriesWidgetQueryOptions({
        organization,
        pageFilters,
        queue: undefined,
        enabled: isSpotCheckEnabled,
        query: params,
      })
    ),
  });

  const comparisons = activeTimeSeriesQueries.map((query, i) => ({
    ...query,
    statsResult: statsQueryResults[query.originalQueryIndex],
    timeSeriesResult: timeSeriesQueryResults[i],
  }));

  const isComparisonReady =
    isSpotCheckEnabled &&
    comparisons.length > 0 &&
    comparisons.every(
      ({statsResult, timeSeriesResult}) =>
        isSettled(statsResult) && isSettled(timeSeriesResult)
    );

  useEffect(() => {
    const {transformSeries} = config;
    if (!isComparisonReady || !transformSeries) {
      return;
    }

    for (const {
      params,
      widgetQuery,
      originalQueryIndex,
      statsResult,
      timeSeriesResult,
    } of comparisons) {
      if (!statsResult?.data || !timeSeriesResult?.data) {
        continue;
      }
      const differences = findSeriesDifferences(
        transformSeries(statsResult.data, widgetQuery, organization),
        transformSeries(timeSeriesResult.data, widgetQuery, organization)
      );

      if (differences.length > 0) {
        warn('Dashboard widget `/events-timeseries/` spot-check mismatch', {
          dataset: params.dataset,
          displayType: widget.displayType,
          widgetId: widget.id,
          queryIndex: originalQueryIndex,
          differences: JSON.stringify(differences.slice(0, 5)),
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComparisonReady]);
}
