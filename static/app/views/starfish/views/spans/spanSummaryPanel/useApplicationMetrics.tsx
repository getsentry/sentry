import {useQuery} from 'sentry/utils/queryClient';
import {HOST} from 'sentry/views/starfish/utils/constants';

type Metrics = {
  count: number;
  total_time: number;
};

export const useApplicationMetrics = (referrer = 'application-metrics') => {
  const query = `
  SELECT
  count() as count,
  sum(exclusive_time) as total_time
  FROM spans_experimental_starfish
`;

  const {isLoading, error, data} = useQuery<Metrics[]>({
    queryKey: ['span-metrics'],
    queryFn: () =>
      fetch(`${HOST}/?query=${query}&referrer=${referrer}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  return {isLoading, error, data: data[0]};
};
