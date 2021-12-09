import moment from 'moment';

import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import {defined} from 'sentry/utils';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

// Sentry treats transactions with a status other than “ok,” “cancelled”, and “unknown” as failures.
// For more details, see https://docs.sentry.io/product/performance/metrics/#failure-rate
const TRANSACTION_SUCCESS_STATUS = ['ok', 'unknown', 'cancelled'];

export function transformMetricsToArea<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: MetricsRequestRenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = getParams(widgetProps.location.query);

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

  if (!response || !responsePrevious) {
    return {
      ...commonChildData,
      hasData: false,
      data: [],
      dataMean: undefined,
      previousData: undefined,
    };
  }

  const metricsField = widgetProps.fields[0];

  const isFailureRateWidget =
    widgetProps.chartSetting === PerformanceWidgetSetting.FAILURE_RATE_AREA;

  const groups = isFailureRateWidget
    ? response.groups.filter(
        group => !TRANSACTION_SUCCESS_STATUS.includes(group.by['transaction.status'])
      )
    : response.groups;

  const totalPerBucket = isFailureRateWidget
    ? response.intervals.map((_intervalValue, intervalIndex) =>
        response.groups.reduce(
          (acc, group) => acc + group.series[metricsField][intervalIndex],
          0
        )
      )
    : undefined;

  const data = groups.map(group => ({
    seriesName: metricsField,
    totals: group.totals[metricsField],
    aggregation: defined(totalPerBucket) ? 'failure_rate()' : undefined,
    data: response.intervals.map((intervalValue, intervalIndex) => ({
      name: moment(intervalValue).valueOf(),
      value: defined(totalPerBucket)
        ? group.series[metricsField][intervalIndex] / totalPerBucket[intervalIndex]
        : group.series[metricsField][intervalIndex],
    })),
  }));

  const seriesTotal = isFailureRateWidget
    ? response.groups.reduce((acc, group) => acc + group.totals[metricsField], 0)
    : undefined;

  const dataMean = data.map(({seriesName, totals, aggregation, ...serie}) => {
    const meanData = defined(seriesTotal)
      ? totals / seriesTotal
      : totals / serie.data.length;

    return {
      mean: meanData,
      outputType: aggregateOutputType(aggregation ?? seriesName),
      label: axisLabelFormatter(meanData, aggregation ?? seriesName),
    };
  });

  const previousGroups = isFailureRateWidget
    ? responsePrevious.groups.filter(
        group => !TRANSACTION_SUCCESS_STATUS.includes(group.by['transaction.status'])
      )
    : responsePrevious.groups;

  const previousTotalPerBucket = isFailureRateWidget
    ? responsePrevious.intervals.map((_intervalValue, intervalIndex) =>
        responsePrevious.groups.reduce(
          (acc, group) => acc + group.series[metricsField][intervalIndex],
          0
        )
      )
    : undefined;

  const previousData = previousGroups.map(group => ({
    seriesName: `previous ${metricsField}`,
    aggregation: defined(previousTotalPerBucket) ? 'failure_rate()' : undefined,
    data: response?.intervals.map((intervalValue, intervalIndex) => ({
      name: moment(intervalValue).valueOf(),
      value: defined(previousTotalPerBucket)
        ? group.series[metricsField][intervalIndex] /
          previousTotalPerBucket[intervalIndex]
        : group.series[metricsField][intervalIndex],
    })),
    stack: 'previous',
  }));

  return {
    ...commonChildData,
    hasData: defined(data) && !!data.length && !!data[0].data.length,
    data,
    dataMean,
    previousData: previousData ?? undefined,
  };
}
