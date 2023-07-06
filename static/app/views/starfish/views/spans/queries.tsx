import {unix} from 'moment';

import {getInterval} from 'sentry/components/charts/utils';
import {NewQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';

export const useErrorRateQuery = (queryString: string) => {
  const pageFilters = usePageFilters();

  const discoverQuery: NewQuery = {
    id: undefined,
    name: 'HTTP Module - HTTP error rate',
    fields: ['http_error_count()'],
    query: queryString,
    version: 1,
    topEvents: '5',
    dataset: DiscoverDatasets.SPANS_METRICS,
    interval: getInterval(pageFilters.selection.datetime, 'low'),
    yAxis: ['http_error_count()'],
  };

  const eventView = EventView.fromNewQueryWithPageFilters(
    discoverQuery,
    pageFilters.selection
  );

  const result = useSpansQuery<{'http_error_count()': number; interval: number}[]>({
    eventView,
    initialData: [],
  });

  const formattedData = result?.data?.map(entry => {
    return {
      interval: unix(entry.interval).format('YYYY-MM-DDTHH:mm:ss'),
      'http_error_count()': entry['http_error_count()'],
    };
  });

  return {...result, formattedData};
};
