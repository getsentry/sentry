import moment from 'moment';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {defined} from 'sentry/utils';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/performance/data';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

export function transformMetricsToVitalSeries<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: MetricsRequestRenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = normalizeDateTimeParams(
    widgetProps.location.query,
    {
      defaultStatsPeriod: DEFAULT_STATS_PERIOD,
    }
  );

  const metricsField = widgetProps.Queries.chart.fields[0];

  const {errored, loading, reloading, response} = results;

  const data =
    response?.groups.reduce((acc, group) => {
      acc[group.by.transaction] = [
        ...(acc[group.by.transaction] ?? []),
        {
          seriesName: group.by.measurement_rating,
          data: response.intervals.map((intervalValue, intervalIndex) => {
            return {
              name: moment(intervalValue).valueOf(),
              value: group.series[metricsField][intervalIndex],
            };
          }),
        },
      ];
      return acc;
    }, {}) ?? {};

  const childData = {
    loading,
    reloading,
    isLoading: loading || reloading,
    isErrored: errored,
    hasData: defined(response) && !!response.groups.length,
    response,
    data,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}
