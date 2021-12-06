import mean from 'lodash/mean';
import moment from 'moment';

import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import {defined} from 'sentry/utils';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

export function transformMetricsToArea<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: MetricsRequestRenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = getParams(widgetProps.location.query);

  const {errored, loading, reloading, response, responsePrevious} = results;

  const metricsField = widgetProps.fields[0];

  const data =
    response?.groups.map(group => {
      return {
        seriesName: metricsField,
        data: response.intervals.map((intervalValue, intervalIndex) => {
          return {
            name: moment(intervalValue).valueOf(),
            value: group.series[metricsField][intervalIndex],
          };
        }),
      };
    }) ?? [];

  const dataMean = data.map(series => {
    const meanData = mean(series.data.map(({value}) => value));
    return {
      mean: meanData,
      outputType: aggregateOutputType(series.seriesName),
      label: axisLabelFormatter(meanData, series.seriesName),
    };
  });

  const previousData =
    response &&
    responsePrevious?.groups.map(group => {
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
    loading,
    reloading,
    isLoading: loading || reloading,
    isErrored: errored,
    hasData: defined(data) && !!data.length && !!data[0].data.length,
    data,
    dataMean,
    previousData: previousData ?? undefined,

    utc: utc === 'true',
    interval,
    statsPeriod: statsPeriod ?? undefined,
    start: start ?? '',
    end: end ?? '',
  };

  return childData;
}
