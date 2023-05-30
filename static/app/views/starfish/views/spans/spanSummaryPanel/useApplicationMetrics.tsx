import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';
import {getDateQueryFilter} from 'sentry/views/starfish/utils/getDateQueryFilter';

type Metrics = {
  count: number;
  total_time: number;
};

export const useApplicationMetrics = (referrer = 'application-metrics') => {
  const pageFilters = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilters);
  const dateFilters = getDateQueryFilter(startTime, endTime);

  const query = `
  SELECT
  count() as count,
  sum(exclusive_time) as total_time
  FROM spans_experimental_starfish
  WHERE 1 = 1
  ${dateFilters}
`;

  const {isLoading, error, data} = useQuery<Metrics[]>({
    queryKey: ['span-metrics'],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  return {isLoading, error, data: data[0] ?? {}};
};
