import sortBy from 'lodash/sortBy';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {getIntervalForMetricFunction} from 'sentry/views/insights/database/utils/getIntervalForMetricFunction';

// TODO: Add some documentation
// Pick the highest possible interval for the given yAxis selection. Find the ideal interval for each function, then choose the largest one. This results in the lowest granularity, but best performance.
export function getIntervalForTimeSeriesQuery(
  yAxis: string | string[],
  datetime: DateTimeObject
): string {
  if (yAxis.length === 0) {
    return DEFAULT_INTERVAL;
  }

  return sortBy(
    (Array.isArray(yAxis) ? yAxis : [yAxis]).map(yAxisFunctionName => {
      const parseResult = parseFunction(yAxisFunctionName);

      if (!parseResult) {
        return DEFAULT_INTERVAL;
      }

      return getIntervalForMetricFunction(parseResult.name, datetime);
    }),
    intervalToMilliseconds
  ).at(-1)!; // NOTE: Non-null assertion because we check the length at the start of the function!
}

const DEFAULT_INTERVAL = '10m';
