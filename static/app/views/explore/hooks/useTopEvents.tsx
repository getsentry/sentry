import {useMemo} from 'react';

import {useGroupBys} from './useGroupBys';
import {useResultMode} from './useResultsMode';
import {useVisualizes} from './useVisualizes';

export const TOP_EVENTS_LIMIT: number = 5;

export function useTopEvents(): number | undefined {
  const [visualizes] = useVisualizes();
  const {groupBys} = useGroupBys();
  const [resultMode] = useResultMode();

  const hasChartWithMultipleYaxes = useMemo(() => {
    return visualizes.some(visualize => visualize.yAxes.length > 1);
  }, [visualizes]);

  const topEvents: number | undefined = useMemo(() => {
    if (resultMode === 'samples') {
      return undefined;
    }

    // We only support top events for when there are no multiple y-axes chart
    // and there is at least one group by.
    return hasChartWithMultipleYaxes || (groupBys.length === 1 && groupBys[0] === '')
      ? undefined
      : TOP_EVENTS_LIMIT;
  }, [hasChartWithMultipleYaxes, groupBys, resultMode]);

  return topEvents;
}
