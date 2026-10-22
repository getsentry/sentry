import {useQueryParamsSortBys} from 'sentry/views/explore/queryParams/context';

export function useLogsQueryHighFidelity() {
  const sortBys = useQueryParamsSortBys();

  // we can only turn on high accuracy flex time sampling when
  // the order by is exactly timestamp descending,
  return (
    sortBys.length === 1 &&
    sortBys[0]?.field === 'timestamp' &&
    sortBys[0]?.kind === 'desc'
  );
}
