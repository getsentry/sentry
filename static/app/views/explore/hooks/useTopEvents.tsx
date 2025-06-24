import {useMemo} from 'react';

import {
  useExploreGroupBys,
  useExploreMode,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

export const TOP_EVENTS_LIMIT = 5;

// TODO: There's a limitation with this hook when a top n query < 5 series.
// This hook always returns 5, which can be misleading, but there's no simple way
// to get the series count without adding more complexity to this hook.
export function useTopEvents(): number | undefined {
  const groupBys = useExploreGroupBys();
  const mode = useExploreMode();

  const topEvents: number | undefined = useMemo(() => {
    // We only support top events in aggregates mode for
    // when there are no multiple y-axes chart and there is at least one group by.

    if (mode === Mode.SAMPLES) {
      return undefined;
    }

    if (groupBys.every(groupBy => groupBy === '')) {
      return undefined;
    }

    return TOP_EVENTS_LIMIT;
  }, [groupBys, mode]);

  return topEvents;
}
