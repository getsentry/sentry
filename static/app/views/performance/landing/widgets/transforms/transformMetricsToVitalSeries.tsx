import moment from 'moment';

import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import {defined} from 'sentry/utils';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/performance/data';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

export function transformMetricsToVitalSeries<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: MetricsRequestRenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = getParams(widgetProps.location.query, {
    defaultStatsPeriod: DEFAULT_STATS_PERIOD,
  });

  const metricsField = widgetProps.Queries.chart.fields[0];

  const {errored, loading, reloading, response} = results;

  const data = response?.groups.map(group => {
    return {
      seriesName: group.by.measurement_rating,
      data: response.intervals.map((intervalValue, intervalIndex) => {
        return {
          name: moment(intervalValue).valueOf(),
          value: group.series[metricsField][intervalIndex],
        };
      }),
    };
  });

  const childData = {
    loading,
    reloading,
    isLoading: loading || reloading,
    isErrored: errored,
    hasData: defined(response) && !!response.groups.length,
    data,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}
