import sortBy from 'lodash/sortBy';

import type {PageFilters} from 'sentry/types/core';
import EventView from 'sentry/utils/discover/eventView';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getIntervalForMetricFunction} from 'sentry/views/insights/database/utils/getIntervalForMetricFunction';
import {DEFAULT_INTERVAL} from 'sentry/views/insights/settings';

export function getSeriesEventView(
  search: MutableSearch | undefined,
  fields: string[] = [],
  pageFilters: PageFilters,
  yAxis: string[],
  topEvents?: number,
  dataset?: DiscoverDatasets,
  orderby?: string | string[]
) {
  // Pick the highest possible interval for the given yAxis selection. Find the ideal interval for each function, then choose the largest one. This results in the lowest granularity, but best performance.
  const interval = sortBy(
    yAxis.map(yAxisFunctionName => {
      const parseResult = parseFunction(yAxisFunctionName);

      if (!parseResult) {
        return DEFAULT_INTERVAL;
      }

      return getIntervalForMetricFunction(parseResult.name, pageFilters.datetime);
    }),
    result => {
      return intervalToMilliseconds(result);
    }
  ).at(-1);

  return EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      query: search?.formatString() ?? undefined,
      fields,
      yAxis,
      dataset: dataset || DiscoverDatasets.SPANS_METRICS,
      interval,
      topEvents: topEvents?.toString(),
      version: 2,
      orderby,
    },
    pageFilters
  );
}
