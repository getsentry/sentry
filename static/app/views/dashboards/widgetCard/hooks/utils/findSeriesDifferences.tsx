import isEqualWith from 'lodash/isEqualWith';

import type {Series} from 'sentry/types/echarts';
import {areNumbersAlmostEqual} from 'sentry/utils/number/areNumbersAlmostEqual';
import type {WidgetSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';

type SeriesDifference = {
  reason: 'unmatchedSeries' | 'length' | 'timestamp' | 'value' | 'other';
};

function normalizeSeries(series: WidgetSeries[]) {
  return series.map(({timeSeries: _timeSeries, ...rest}) => ({
    ...rest,
    // Skip the first and last buckets since their values are the most volatile
    data: rest.data.slice(1, -1),
  }));
}

// Compares the series built from `/events-stats/` and `/events-timeseries/` responses
export function findSeriesDifferences(
  legacySeries: Series[],
  timeSeries: Series[]
): SeriesDifference[] {
  const differences: SeriesDifference[] = [];
  const unmatchedTimeSeries = new Map(
    timeSeries.map(series => [series.seriesName, series])
  );

  for (const {seriesName, data} of legacySeries) {
    const matchingTimeSeries = unmatchedTimeSeries.get(seriesName);
    unmatchedTimeSeries.delete(seriesName);

    if (!matchingTimeSeries) {
      differences.push({reason: 'unmatchedSeries'});
    } else if (matchingTimeSeries.data.length === data.length) {
      const buckets = data.map((item, i) => [item, matchingTimeSeries.data[i]!] as const);

      if (buckets.some(([item, matchingItem]) => item.name !== matchingItem.name)) {
        differences.push({reason: 'timestamp'});
      } else if (
        // Skip the first and last buckets since their values are the most volatile
        buckets
          .slice(1, -1)
          .some(
            ([item, matchingItem]) =>
              !areNumbersAlmostEqual(item.value, matchingItem.value)
          )
      ) {
        differences.push({reason: 'value'});
      }
    } else {
      differences.push({reason: 'length'});
    }
  }

  for (const _seriesName of unmatchedTimeSeries.keys()) {
    differences.push({reason: 'unmatchedSeries'});
  }

  // Fallback for anything the checks above don't look for
  if (
    differences.length === 0 &&
    !isEqualWith(
      normalizeSeries(legacySeries),
      normalizeSeries(timeSeries),
      (a, b, key) =>
        key === 'value' && typeof a === 'number' && typeof b === 'number'
          ? areNumbersAlmostEqual(a, b)
          : undefined
    )
  ) {
    differences.push({reason: 'other'});
  }

  return differences;
}
