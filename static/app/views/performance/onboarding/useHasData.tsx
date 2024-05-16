import type {PageFilters} from 'sentry/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';

export function useHasData(filter: string, referrer: string) {
  const pageFilters = usePageFilters();
  const ninetyDayPageFilters: PageFilters = {
    ...pageFilters.selection,
    datetime: {
      period: '90d',
      start: null,
      end: null,
      utc: pageFilters.selection.datetime.utc,
    },
  };
  const mutableSearch = new MutableSearch(filter);
  const {data, isLoading, error} = useSpanMetrics(
    {
      search: mutableSearch,
      fields: ['count()'],
      pageFilters: ninetyDayPageFilters,
    },
    referrer
  );
  if (isLoading) {
    return {hasData: false, isLoading: true};
  }
  if (data?.[0]?.['count()'] > 0) {
    return {hasData: true, isLoading: false, error};
  }
  return {hasData: false, isLoading: false, error};
}
