import mean from 'lodash/mean';
import moment from 'moment';

import {getPreviousSeriesName} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';

import {WidgetDataConstraint, WidgetPropUnion} from '../types';

// Sentry treats transactions with a status other than “ok,” “cancelled”, and “unknown” as failures.
// For more details, see https://docs.sentry.io/product/performance/metrics/#failure-rate
const TRANSACTION_SUCCESS_STATUS = ['ok', 'unknown', 'cancelled'];

export function transformMetricsToArea<T extends WidgetDataConstraint>(
  widgetProps: Pick<WidgetPropUnion<T>, 'location' | 'fields'>,
  results: MetricsRequestRenderProps,
  failureRate = false
) {
  const {location, fields} = widgetProps;

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

  if (failureRate) {
    const failedGroups = response.groups.filter(
      group => !TRANSACTION_SUCCESS_STATUS.includes(group.by['transaction.status'])
    );

    const totalPerBucket = response.intervals.map((_intervalValue, intervalIndex) =>
      response.groups.reduce(
        (acc, group) => acc + (group.series[metricsField]?.[intervalIndex] ?? 0),
        0
      )
    );

    const totalFailurePerBucket = response.intervals.map(
      (_intervalValue, intervalIndex) =>
        failedGroups.reduce(
          (acc, group) => acc + (group.series[metricsField]?.[intervalIndex] ?? 0),
          0
        )
    );

    const series = response.intervals.map((intervalValue, intervalIndex) => {
      const totalSerieBucket = totalPerBucket[intervalIndex];
      const totalFailureSerieBucket = totalFailurePerBucket[intervalIndex];

      return {
        name: moment(intervalValue).valueOf(),
        value: totalFailureSerieBucket / totalSerieBucket,
      };
    }) as SeriesDataUnit[];

    const data = [
      {
        seriesName: 'failure_rate()',
        data: series.some(serie => defined(serie.value)) ? series : [],
      },
    ];

    const seriesTotal = response.groups.reduce(
      (acc, group) => acc + (group.totals[metricsField] ?? 0),
      0
    );

    const seriesTotalFailure = failedGroups.reduce(
      (acc, group) => acc + (group.totals[metricsField] ?? 0),
      0
    );

    const dataMean = data.map(serie => {
      const meanData = seriesTotalFailure / seriesTotal;

      return {
        mean: meanData,
        outputType: aggregateOutputType(serie.seriesName),
        label: axisLabelFormatter(meanData, serie.seriesName),
      };
    });

    const previousFailedGroups = responsePrevious?.groups.filter(
      group => !TRANSACTION_SUCCESS_STATUS.includes(group.by['transaction.status'])
    );

    const previousTotalPerBucket = responsePrevious?.intervals.map(
      (_intervalValue, intervalIndex) =>
        responsePrevious?.groups.reduce(
          (acc, group) => acc + (group.series[metricsField]?.[intervalIndex] ?? 0),
          0
        )
    );

    const previousTotalFailurePerBucket = responsePrevious?.intervals.map(
      (_intervalValue, intervalIndex) =>
        previousFailedGroups?.reduce(
          (acc, group) => acc + (group.series[metricsField]?.[intervalIndex] ?? 0),
          0
        )
    );

    const previousSeries = response.intervals.map((intervalValue, intervalIndex) => {
      const totalSerieBucket = previousTotalPerBucket?.[intervalIndex];
      const totalFailureSerieBucket = previousTotalFailurePerBucket?.[intervalIndex];

      return {
        name: moment(intervalValue).valueOf(),
        value:
          defined(totalFailureSerieBucket) && defined(totalSerieBucket)
            ? totalFailureSerieBucket / totalSerieBucket
            : totalFailureSerieBucket,
      };
    }) as SeriesDataUnit[];

    const previousData = [
      {
        seriesName: 'previous failure_rate()',
        stack: 'previous',
        data: previousSeries.some(serie => defined(serie.value)) ? previousSeries : [],
      },
    ];

    return {
      ...commonChildData,
      hasData: !!data[0].data.length,
      data: data as Series[],
      dataMean,
      previousData,
    };
  }

  const data = response.groups.map(group => {
    const series = response.intervals.map((intervalValue, intervalIndex) => ({
      name: moment(intervalValue).valueOf(),
      value: group.series[metricsField]?.[intervalIndex],
    }));

    return {
      seriesName: metricsField,
      totals: group.totals[metricsField],
      data: series.some(serie => defined(serie.value)) ? series : [],
    };
  });

  const dataMean = data.map(serie => {
    const serieData = serie.data
      .filter(({value}) => defined(value))
      .map(({value}) => value);

    const meanData = serieData.length > 0 ? mean(serieData) : undefined;

    return {
      mean: meanData,
      outputType: aggregateOutputType(serie.seriesName),
      label: defined(meanData)
        ? axisLabelFormatter(meanData, serie.seriesName)
        : undefined,
    };
  });

  const previousData = responsePrevious?.groups?.map(group => {
    const series = response?.intervals.map((intervalValue, intervalIndex) => ({
      name: moment(intervalValue).valueOf(),
      value: group.series[metricsField]?.[intervalIndex],
    }));

    return {
      seriesName: getPreviousSeriesName(metricsField),
      stack: 'previous',
      data: series.some(serie => defined(serie.value)) ? series : [],
    };
  }) as null | Series[];

  return {
    ...commonChildData,
    hasData: !!data.length && !!data[0].data.length,
    data: data as Series[],
    dataMean,
    previousData: previousData ?? undefined,
  };
}
