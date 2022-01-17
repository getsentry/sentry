import moment from 'moment';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/performance/data';

import {WidgetDataConstraint, WidgetPropUnion} from '../types';

export function transformMetricsToVitalSeries<T extends WidgetDataConstraint>(
  widgetProps: Pick<WidgetPropUnion<T>, 'location' | 'fields'>,
  results: MetricsRequestRenderProps
) {
  const {location, fields} = widgetProps;

  const metricsField = fields[0];

  const {start, end, utc, interval, statsPeriod} = normalizeDateTimeParams(
    location.query,
    {
      defaultStatsPeriod: DEFAULT_STATS_PERIOD,
    }
  );

  const {errored, loading, reloading, response} = results;

  const data = (response?.groups.reduce((acc, group) => {
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
  }, {}) ?? {}) as Series;

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
