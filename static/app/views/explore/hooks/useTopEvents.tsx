import {useMemo} from 'react';

import {useQueryParamsGroupBys} from 'sentry/views/explore/queryParams/context';

export const TOP_EVENTS_LIMIT = 9;

// TODO: There's a limitation with this hook when a top n query < 9 series.
// This hook always returns 9, which can be misleading, but there's no simple way
// to get the series count without adding more complexity to this hook.
export function useTopEvents(): number | undefined {
  const groupBys = useQueryParamsGroupBys();

  const topEvents: number | undefined = useMemo(() => {
    if (groupBys.every(groupBy => groupBy === '')) {
      return;
    }

    return TOP_EVENTS_LIMIT;
  }, [groupBys]);

  return topEvents;
}
