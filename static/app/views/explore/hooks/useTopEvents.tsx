import {useMemo} from 'react';

import {
  useExploreGroupBys,
  useExploreMode,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

export const TOP_EVENTS_LIMIT = 5;

// TODO: There's a limitation with this hook when a top n query < 5 series.
// This hook always returns 5, which can be misleading, but there's no simple way
// to get the series count without adding more complexity to this hook.
export function useTopEvents(): number | undefined {
  const visualizes = useExploreVisualizes();
  const groupBys = useExploreGroupBys();
  const mode = useExploreMode();

  const hasChartWithMultipleYaxes = useMemo(() => {
    return visualizes.some(visualize => visualize.yAxes.length > 1);
  }, [visualizes]);

  const topEvents: number | undefined = useMemo(() => {
    if (mode === Mode.SAMPLES) {
      return undefined;
    }

    // We only support top events for when there are no multiple y-axes chart
    // and there is at least one group by.
    return hasChartWithMultipleYaxes || (groupBys.length === 1 && groupBys[0] === '')
      ? undefined
      : TOP_EVENTS_LIMIT;
  }, [hasChartWithMultipleYaxes, groupBys, mode]);

  return topEvents;
}
