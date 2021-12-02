import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import {defined} from 'sentry/utils';
import {MetricsRequestRenderProps} from 'sentry/utils/metrics/metricsRequest';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/performance/data';

import {QueryDefinitionWithKey, WidgetDataConstraint, WidgetPropUnion} from '../types';

export type VitalsMetricsItem = {
  transaction: string;
  measurement_rating: {
    poor: number;
    meh: number;
    good: number;
  };
};

export function transformMetricsToVitalList<T extends WidgetDataConstraint>(
  widgetProps: WidgetPropUnion<T>,
  results: MetricsRequestRenderProps,
  _: QueryDefinitionWithKey<T>
) {
  const {start, end, utc, interval, statsPeriod} = getParams(widgetProps.location.query, {
    defaultStatsPeriod: DEFAULT_STATS_PERIOD,
  });

  const metricsField = widgetProps.Queries.list.fields[0];

  const {errored, loading, reloading, response} = results;

  const data =
    results.response?.groups.reduce((acc, group) => {
      const foundTransaction = acc.find(
        item => item.transaction === group.by.transaction
      );
      if (foundTransaction) {
        foundTransaction.measurement_rating = {
          ...foundTransaction.measurement_rating,
          [group.by.measurement_rating]: group.totals[metricsField],
        };
        return acc;
      }

      acc.push({
        transaction: String(group.by.transaction),
        measurement_rating: {
          [group.by.measurement_rating]: group.totals[metricsField],
        } as VitalsMetricsItem['measurement_rating'],
      });
      return acc;
    }, [] as VitalsMetricsItem[]) ?? [];

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
