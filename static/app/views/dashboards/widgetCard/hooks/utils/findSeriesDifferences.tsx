import isEqualWith from 'lodash/isEqualWith';

import type {Series} from 'sentry/types/echarts';
import {areNumbersAlmostEqual} from 'sentry/utils/number/areNumbersAlmostEqual';
import type {WidgetSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';

// Maximum percentage difference allowed between bucket values
const VALUE_DIFFERENCE_THRESHOLD_PERCENTAGE = 3;
const LENGTH_DIFFERENCE_TOLERANCE = 1;

type Bucket = Series['data'][number];

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

// Bucket values may also be `NaN`, which is not considered equal in `areNumbersAlmostEqual`
// For the purpose of this function, we consider `NaN` values to be equal, so check with `Object.is` first
function areValuesAlmostEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'number' || typeof b !== 'number') {
    return false;
  }
  return areNumbersAlmostEqual(a, b, VALUE_DIFFERENCE_THRESHOLD_PERCENTAGE);
}

function normalizeSeries(series: WidgetSeries[]) {
  return series.map(({timeSeries: _timeSeries, ...rest}) => ({
    ...rest,
    // Skip the first and last buckets since their values are the most volatile
    data: rest.data.slice(1, -1),
  }));
}

function alignBuckets(legacy: Bucket[], timeSeries: Bucket[]): [Bucket[], Bucket[]] {
  if (legacy.length === timeSeries.length) {
    return [legacy, timeSeries];
  }

  const isLegacyLonger = legacy.length > timeSeries.length;
  const [longer, shorter] = isLegacyLonger ? [legacy, timeSeries] : [timeSeries, legacy];
  const trimmed =
    longer[0]?.name === shorter[0]?.name ? longer.slice(0, -1) : longer.slice(1);

  return isLegacyLonger ? [trimmed, timeSeries] : [legacy, trimmed];
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
  const alignedData = new Map<string, [Bucket[], Bucket[]]>();

  for (const {seriesName, data} of legacySeries) {
    const matchingTimeSeries = unmatchedTimeSeries.get(seriesName);
    unmatchedTimeSeries.delete(seriesName);

    if (!matchingTimeSeries) {
      differences.push({reason: 'unmatchedLegacySeries'});
    } else if (
      Math.abs(matchingTimeSeries.data.length - data.length) > LENGTH_DIFFERENCE_TOLERANCE
    ) {
      differences.push({
        reason: 'length',
        legacyLength: data.length,
        timeSeriesLength: matchingTimeSeries.data.length,
      });
    } else {
      const [legacyData, timeSeriesData] = alignBuckets(data, matchingTimeSeries.data);
      alignedData.set(seriesName, [legacyData, timeSeriesData]);
      const buckets = legacyData.map((item, i) => [item, timeSeriesData[i]!] as const);

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
                !areValuesAlmostEqual(item.value, matchingItem.value)
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
    }
  }

  for (const _seriesName of unmatchedTimeSeries.keys()) {
    differences.push({reason: 'unmatchedTimeSeries'});
  }

  // Fallback for anything the checks above don't look for
  if (
    differences.length === 0 &&
    !isEqualWith(
      normalizeSeries(
        legacySeries.map(series => ({
          ...series,
          data: alignedData.get(series.seriesName)?.[0] ?? series.data,
        }))
      ),
      normalizeSeries(
        timeSeries.map(series => ({
          ...series,
          data: alignedData.get(series.seriesName)?.[1] ?? series.data,
        }))
      ),
      (a, b, key) => (key === 'value' ? areValuesAlmostEqual(a, b) : undefined)
    )
  ) {
    differences.push({reason: 'other'});
  }

  return differences;
}
