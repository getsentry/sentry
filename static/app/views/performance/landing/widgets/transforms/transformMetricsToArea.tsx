import moment from 'moment';

import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import {defined} from 'sentry/utils';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';
import {PerformanceWidgetSetting} from '../widgetDefinitions';

// Sentry treats transactions with a status other than “ok,” “canceled,” and “unknown” as failures.
// For more details, see https://docs.sentry.io/product/performance/metrics/#failure-rate
const TRANSACTION_SUCCESS_STATUS = ['ok', 'unknown', 'canceled'];

export function transformMetricsToArea<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: MetricsRequestRenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = getParams(widgetProps.location.query);

  const {errored, loading, reloading, response, responsePrevious} = results;

  const metricsField = widgetProps.fields[0];

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

  if (widgetProps.chartSetting === PerformanceWidgetSetting.FAILURE_RATE_AREA) {
    const failureGroups = response.groups.filter(
      group => !TRANSACTION_SUCCESS_STATUS.includes(group.by['transaction.status'])
    );

    const seriesTotal = response.groups.reduce(
      (acc, group) => acc + group.totals[metricsField],
      0
    );

    const totalPerBucket = response.intervals.map((_intervalValue, intervalIndex) => {
      return response.groups.reduce((acc, group) => {
        return acc + group.series[metricsField][intervalIndex];
      }, 0);
    });

    const data = failureGroups.map(failureGroup => ({
      seriesName: metricsField,
      totals: failureGroup.totals[metricsField],
      data: response.intervals.map((intervalValue, intervalIndex) => {
        return {
          name: moment(intervalValue).valueOf(),
          value:
            failureGroup.series[metricsField][intervalIndex] /
            totalPerBucket[intervalIndex],
        };
      }),
    }));

    const dataMean = data.map(serie => {
      const meanData = serie.totals / seriesTotal;
      return {
        mean: meanData,
        outputType: aggregateOutputType('failure_rate()'),
        label: axisLabelFormatter(meanData, 'failure_rate()'),
      };
    });

    const previousFailureGroups = responsePrevious.groups.filter(
      group => !TRANSACTION_SUCCESSFUL_STATUS.includes(group.by['transaction.status'])
    );

    const previousTotalPerBucket = responsePrevious.intervals.map(
      (_intervalValue, intervalIndex) => {
        return responsePrevious.groups.reduce((acc, group) => {
          return acc + group.series[metricsField][intervalIndex];
        }, 0);
      }
    );

    const previousData = previousFailureGroups.map(previousFailureGroup => {
      return {
        seriesName: `previous ${metricsField}`,
        data: response.intervals.map((intervalValue, intervalIndex) => {
          return {
            name: moment(intervalValue).valueOf(),
            value:
              previousFailureGroup.series[metricsField][intervalIndex] /
              previousTotalPerBucket[intervalIndex],
          };
        }),
        stack: 'previous',
      };
    });

    const childData = {
      ...commonChildData,
      hasData: defined(data) && !!data.length && !!data[0].data.length,
      data,
      dataMean,
      previousData: previousData ?? undefined,
    };

    return childData;
  }

  const data = response.groups.map(group => {
    return {
      seriesName: metricsField,
      totals: group.totals[metricsField],
      data: response.intervals.map((intervalValue, intervalIndex) => {
        return {
          name: moment(intervalValue).valueOf(),
          value: group.series[metricsField][intervalIndex],
        };
      }),
    };
  });

  const dataMean = data.map(series => {
    const meanData = series.totals / series.data.length;
    return {
      mean: meanData,
      outputType: aggregateOutputType(series.seriesName),
      label: axisLabelFormatter(meanData, series.seriesName),
    };
  });

  const previousData = responsePrevious.groups.map(group => {
    return {
      seriesName: `previous ${metricsField}`,
      data: response.intervals.map((intervalValue, intervalIndex) => {
        return {
          name: moment(intervalValue).valueOf(),
          value: group.series[metricsField][intervalIndex],
        };
      }),
      stack: 'previous',
    };
  });

  const childData = {
    ...commonChildData,
    hasData: defined(data) && !!data.length && !!data[0].data.length,
    data,
    dataMean,
    previousData: previousData ?? undefined,
  };

  return childData;
}
