import sortBy from 'lodash/sortBy';

import type {DateTimeObject} from 'sentry/components/charts/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {getIntervalForMetricFunction} from 'sentry/views/insights/database/utils/getIntervalForMetricFunction';
import {DEFAULT_INTERVAL} from 'sentry/views/insights/settings';

/**
 * Given a list of requested Y axes and a date range, figures out the most appropriate interval.
 *
 * This is a legacy function that was useful in the days of span metrics, where some metrics were much more expensive to query than others. In the age of EAP, this is not needed anymore. In EAP, granularity is _very cheap_, and we can be more generous with it regardless of the specific metric being queried.
 */
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
