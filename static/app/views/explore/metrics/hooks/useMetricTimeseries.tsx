import {useCallback, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {shouldTriggerHighAccuracy} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {
  SAMPLING_MODE,
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualizes} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

const METRIC_TIMESERIES_REFERRER = 'api.explore.tracemetrics-timeseries';

interface UseMetricTimeseriesOptions {
  enabled: boolean;
  traceMetric: TraceMetric;
}

export function useMetricTimeseries({traceMetric, enabled}: UseMetricTimeseriesOptions) {
  const visualizes = useMetricVisualizes();
  const {selection} = usePageFilters();
  const search = useQueryParamsSearch();
  const groupBys = useQueryParamsGroupBys();
  const [interval] = useChartInterval();

  const topEvents = useTopEvents();
  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useMetricTimeseriesImpl>['result']) => {
      return shouldTriggerHighAccuracy(result.data, visualizes, !!topEvents);
    },
    [topEvents, visualizes]
  );

  const highAccuracyAttributes = useMemo(
    () => ({
      referrer: METRIC_TIMESERIES_REFERRER,
      project_count: selection.projects.length,
      stats_period: selection.datetime.period ?? 'absolute',
    }),
    [selection.projects.length, selection.datetime.period]
  );

  const onHighAccuracyRequest = useCallback(() => {
    Sentry.metrics.count('explore.metrics.timeseries.high_accuracy.request', 1, {
      attributes: highAccuracyAttributes,
    });
  }, [highAccuracyAttributes]);

  const onHighAccuracySuccess = useCallback(() => {
    Sentry.metrics.count('explore.metrics.timeseries.high_accuracy.succeeded', 1, {
      attributes: highAccuracyAttributes,
    });
  }, [highAccuracyAttributes]);

  const onHighAccuracyError = useCallback(
    (result: ReturnType<typeof useMetricTimeseriesImpl>['result']) => {
      Sentry.metrics.count('explore.metrics.timeseries.high_accuracy.failed', 1, {
        attributes: {
          ...highAccuracyAttributes,
          status:
            result.error instanceof RequestError
              ? (result.error.status ?? 'unknown')
              : 'unknown',
          query: JSON.stringify({
            metric: traceMetric,
            aggregates: visualizes.map(
              visualize => parseFunction(visualize.yAxis)?.name ?? 'equation'
            ),
            hasFilter: !search.isEmpty(),
            groupBy: groupBys,
            topEvents,
            interval,
            datetime: selection.datetime,
            projects: selection.projects,
            environments: selection.environments,
          }),
        },
      });
    },
    [
      groupBys,
      highAccuracyAttributes,
      interval,
      search,
      selection.datetime,
      selection.environments,
      selection.projects,
      topEvents,
      traceMetric,
      visualizes,
    ]
  );

  const progressiveResult = useProgressiveQuery<typeof useMetricTimeseriesImpl>({
    queryHookImplementation: useMetricTimeseriesImpl, // oxlint-disable-line react/hooks -- useProgressiveQuery takes the query hook as a value and calls it per accuracy tier.
    queryHookArgs: {traceMetric, queryExtras: undefined, enabled},
    queryOptions: {
      canTriggerHighAccuracy,
      onHighAccuracyRequest,
      onHighAccuracySuccess,
      onHighAccuracyError,
    },
  });

  const {result, samplingMode} = progressiveResult;

  const resultWithTimeoutMessage = useMemo(() => {
    if (
      samplingMode !== SAMPLING_MODE.HIGH_ACCURACY ||
      !result.isError ||
      !(result.error instanceof RequestError) ||
      result.error.status !== 500
    ) {
      return result;
    }

    return {
      ...result,
      error: new Error(
        t(
          'We timed out trying to scan across all of your data. Try reducing the time range.'
        )
      ),
    };
  }, [result, samplingMode]);

  return {...progressiveResult, result: resultWithTimeoutMessage};
}

interface UseMetricTimeseriesImplOptions extends UseMetricTimeseriesOptions {
  queryExtras?: RPCQueryExtras;
}

function useMetricTimeseriesImpl({
  traceMetric,
  queryExtras,
  enabled,
}: UseMetricTimeseriesImplOptions) {
  const visualizes = useMetricVisualizes();
  const groupBys = useQueryParamsGroupBys();
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();
  const search = useQueryParamsSearch();
  const sortBys = useQueryParamsAggregateSortBys();
  const organization = useOrganization();

  const yAxis = useMemo(() => {
    return visualizes.map(v => v.yAxis);
  }, [visualizes]);

  const timeseriesResult = useSortedTimeSeries(
    {
      search,
      yAxis,
      interval,
      fields: [...groupBys, ...yAxis],
      enabled:
        enabled &&
        (Boolean(traceMetric.name) ||
          visualizes.some(
            visualize => isVisualizeEquation(visualize) && visualize.expression.text
          )),
      topEvents,
      orderby: sortBys.map(formatSort),
      includeMeasuredIngestionDelayMetadata: organization.features.includes(
        'measured-ingestion-delay-ui'
      ),
      ...queryExtras,
    },
    METRIC_TIMESERIES_REFERRER,
    DiscoverDatasets.TRACEMETRICS
  );

  return {
    result: timeseriesResult,
  };
}
