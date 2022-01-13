import mean from 'lodash/mean';
import moment from 'moment';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';

import {WidgetDataConstraint, WidgetPropUnion} from '../types';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

// Sentry treats transactions with a status other than “ok,” “cancelled”, and “unknown” as failures.
// For more details, see https://docs.sentry.io/product/performance/metrics/#failure-rate
const TRANSACTION_SUCCESS_STATUS = ['ok', 'unknown', 'cancelled'];

export function transformMetricsToArea<T extends WidgetDataConstraint>(
  widgetProps: Pick<WidgetPropUnion<T>, 'location' | 'fields' | 'chartSetting'>,
  results: MetricsRequestRenderProps
) {
  const {location, fields, chartSetting} = widgetProps;

  const {start, end, utc, interval, statsPeriod} = normalizeDateTimeParams(
    location.query
  );

  const {errored, loading, reloading, response, responsePrevious} = results;

  const commonChildData = {
    loading,
    reloading,
    isLoading: loading || reloading,
    isErrored: errored,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  if (!response) {
    return {
      ...commonChildData,
      hasData: false,
      data: [] as Series[],
      dataMean: undefined,
      previousData: undefined,
    };
  }

  const metricsField = fields[0];

  const isFailureRateWidget = chartSetting === PerformanceWidgetSetting.FAILURE_RATE_AREA;

  const groups = isFailureRateWidget
    ? response.groups.filter(
        group => !TRANSACTION_SUCCESS_STATUS.includes(group.by['transaction.status'])
      )
    : response.groups;

  const totalPerBucket = isFailureRateWidget
    ? response.intervals.map((_intervalValue, intervalIndex) =>
        response.groups.reduce(
          (acc, group) => acc + (group.series[metricsField][intervalIndex] ?? 0),
          0
        )
      )
    : undefined;

  const data = groups.map(group => {
    const series = response.intervals.map((intervalValue, intervalIndex) => {
      const serieBucket = group.series[metricsField][intervalIndex];
      const totalSerieBucket = totalPerBucket?.[intervalIndex];
      return {
        name: moment(intervalValue).valueOf(),
        value:
          defined(totalSerieBucket) &&
          defined(serieBucket) &&
          serieBucket > 0 &&
          totalSerieBucket > 0
            ? serieBucket / totalSerieBucket
            : serieBucket,
      };
    });

    return {
      seriesName: metricsField,
      totals: group.totals[metricsField],
      data: series.some(serie => defined(serie.value)) ? series : [],
    };
  });

  const seriesTotal = isFailureRateWidget
    ? response.groups.reduce((acc, group) => acc + (group.totals[metricsField] ?? 0), 0)
    : undefined;

  const dataMean = data.map(serie => {
    let meanData: undefined | number = undefined;

    if (
      defined(seriesTotal) &&
      defined(serie.totals) &&
      serie.totals > 0 &&
      seriesTotal > 0
    ) {
      meanData = serie.totals / seriesTotal;
    } else {
      const serieData = serie.data
        .filter(({value}) => defined(value))
        .map(({value}) => value);

      if (serieData.length > 0) {
        meanData = mean(serieData);
      }
    }

    const seriesName = defined(seriesTotal) ? 'failure_rate()' : serie.seriesName;

    return {
      mean: meanData,
      outputType: aggregateOutputType(seriesName),
      label: defined(meanData) ? axisLabelFormatter(meanData, seriesName) : undefined,
    };
  });

  const previousGroups = isFailureRateWidget
    ? responsePrevious?.groups.filter(
        group => !TRANSACTION_SUCCESS_STATUS.includes(group.by['transaction.status'])
      )
    : responsePrevious?.groups;

  const previousTotalPerBucket = isFailureRateWidget
    ? responsePrevious?.intervals.map((_intervalValue, intervalIndex) =>
        responsePrevious?.groups.reduce(
          (acc, group) => acc + (group.series[metricsField][intervalIndex] ?? 0),
          0
        )
      )
    : undefined;

  const previousData = previousGroups?.map(group => {
    const series = response?.intervals.map((intervalValue, intervalIndex) => {
      const serieBucket = group.series[metricsField][intervalIndex];
      const totalSerieBucket = previousTotalPerBucket?.[intervalIndex];

      return {
        name: moment(intervalValue).valueOf(),
        value:
          defined(totalSerieBucket) &&
          defined(serieBucket) &&
          serieBucket > 0 &&
          totalSerieBucket > 0
            ? serieBucket / totalSerieBucket
            : serieBucket,
      };
    });

    return {
      seriesName: `previous ${metricsField}`,
      stack: 'previous',
      data: series.some(serie => defined(serie.value)) ? series : [],
    };
  }) as null | Series[];

  return {
    ...commonChildData,
    hasData: defined(data) && !!data.length && !!data[0].data.length,
    data: data as Series[],
    dataMean,
    previousData: previousData ?? undefined,
  };
}
