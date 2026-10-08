import isEqualWith from 'lodash/isEqualWith';

import type {Series} from 'sentry/types/echarts';
import {areNumbersAlmostEqual} from 'sentry/utils/number/areNumbersAlmostEqual';
import type {WidgetSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';

// Maximum percentage difference allowed between bucket values
const VALUE_DIFFERENCE_THRESHOLD_PERCENTAGE = 3;

type SeriesDifference = {
  reason:
    | 'unmatchedLegacySeries'
    | 'unmatchedTimeSeries'
    | 'length'
    | 'timestamp'
    | 'value'
    | 'other';
  legacyLength?: number;
  legacyTimestamp?: number | string;
  legacyValue?: number;
  timeSeriesLength?: number;
  timeSeriesTimestamp?: number | string;
  timeSeriesValue?: number;
};

function normalizeSeries(series: WidgetSeries[]) {
  return series.map(({timeSeries: _timeSeries, ...rest}) => ({
    ...rest,
    // Skip the first and last buckets since their values are the most volatile
    data: rest.data.slice(1, -1),
  }));
}

// Compares the series built from `/events-stats/` and `/events-timeseries/` responses.
// Series names are left out of the result since group by values can contain user data.
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
      differences.push({reason: 'unmatchedLegacySeries'});
    } else if (matchingTimeSeries.data.length === data.length) {
      const buckets = data.map((item, i) => [item, matchingTimeSeries.data[i]!] as const);

      const mismatchedTimestamp = buckets.find(
        ([item, matchingItem]) => item.name !== matchingItem.name
      );
      // Skip the first and last buckets since their values are the most volatile
      const mismatchedValue = mismatchedTimestamp
        ? undefined
        : buckets
            .slice(1, -1)
            .find(
              ([item, matchingItem]) =>
                !areNumbersAlmostEqual(
                  item.value,
                  matchingItem.value,
                  VALUE_DIFFERENCE_THRESHOLD_PERCENTAGE
                )
            );

      if (mismatchedTimestamp) {
        const [item, matchingItem] = mismatchedTimestamp;
        differences.push({
          reason: 'timestamp',
          legacyTimestamp: item.name,
          timeSeriesTimestamp: matchingItem.name,
        });
      } else if (mismatchedValue) {
        const [item, matchingItem] = mismatchedValue;
        differences.push({
          reason: 'value',
          legacyValue: item.value,
          timeSeriesValue: matchingItem.value,
        });
      }
    } else {
      differences.push({
        reason: 'length',
        legacyLength: data.length,
        timeSeriesLength: matchingTimeSeries.data.length,
      });
    }
  }

  for (const _seriesName of unmatchedTimeSeries.keys()) {
    differences.push({reason: 'unmatchedTimeSeries'});
  }

  // Fallback for anything the checks above don't look for
  if (
    differences.length === 0 &&
    !isEqualWith(
      normalizeSeries(legacySeries),
      normalizeSeries(timeSeries),
      (a, b, key) =>
        key === 'value' && typeof a === 'number' && typeof b === 'number'
          ? areNumbersAlmostEqual(a, b, VALUE_DIFFERENCE_THRESHOLD_PERCENTAGE)
          : undefined
    )
  ) {
    differences.push({reason: 'other'});
  }

  return differences;
}
