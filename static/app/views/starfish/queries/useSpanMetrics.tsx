import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Span} from 'sentry/views/starfish/queries/types';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';

const INTERVAL = 12;

type Metrics = {
  count: number;
  first_seen: string;
  last_seen: string;
  p50: number;
  spm: number;
  total_time: number;
};

export const useSpanMetrics = (
  span?: Pick<Span, 'group_id'>,
  queryFilters: {transactionName?: string} = {},
  referrer = 'span-metrics'
) => {
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);
  const filters: string[] = [];
  if (queryFilters.transactionName) {
    filters.push(`transaction = ${queryFilters.transactionName}`);
  }

  const query = span
    ? `
  SELECT
  count() as count,
  min(timestamp) as first_seen,
  max(timestamp) as last_seen,
  sum(exclusive_time) as total_time,
  quantile(0.5)(exclusive_time) as p50,
  divide(count, multiply(${INTERVAL}, 60)) as spm
  FROM spans_experimental_starfish
  WHERE group_id = '${span.group_id}'
  ${dateFilters}
  ${filters.join(' AND ')}`
    : '';

  const {isLoading, error, data} = useQuery<Metrics[]>({
    queryKey: ['span-metrics', span?.group_id, dateFilters],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
    enabled: Boolean(span),
  });

  return {isLoading, error, data: data[0] ?? {}};
};
