import {useMemo} from 'react';

import {useExploreGroupBys} from 'sentry/views/explore/contexts/pageParamsContext';

export const TOP_EVENTS_LIMIT = 5;

// TODO: There's a limitation with this hook when a top n query < 5 series.
// This hook always returns 5, which can be misleading, but there's no simple way
// to get the series count without adding more complexity to this hook.
export function useTopEvents(): number | undefined {
  const groupBys = useExploreGroupBys();

  const topEvents: number | undefined = useMemo(() => {
    if (groupBys.every(groupBy => groupBy === '')) {
      return undefined;
    }

    return TOP_EVENTS_LIMIT;
  }, [groupBys]);

  return topEvents;
}
