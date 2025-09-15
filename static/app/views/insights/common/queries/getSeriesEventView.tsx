import type {PageFilters} from 'sentry/types/core';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getIntervalForTimeSeriesQuery} from 'sentry/utils/timeSeries/getIntervalForTimeSeriesQuery';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

export function getSeriesEventView(
  search: MutableSearch | string | undefined,
  fields: string[] = [],
  pageFilters: PageFilters,
  yAxis: string[],
  topEvents?: number,
  dataset?: DiscoverDatasets,
  orderby?: string | string[]
) {
  const interval = getIntervalForTimeSeriesQuery(yAxis, pageFilters.datetime);

  return EventView.fromNewQueryWithPageFilters(
    {
      name: '',
      query: typeof search === 'string' ? search : (search?.formatString() ?? ''),
      fields,
      yAxis,
      dataset: dataset || DiscoverDatasets.SPANS,
      interval,
      topEvents: topEvents?.toString(),
      version: 2,
      orderby,
    },
    pageFilters
  );
}
