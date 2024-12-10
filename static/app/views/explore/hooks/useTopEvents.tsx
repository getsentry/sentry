import {useMemo} from 'react';

import {
  useExploreGroupBys,
  useExploreMode,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

export const TOP_EVENTS_LIMIT: number = 5;

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
