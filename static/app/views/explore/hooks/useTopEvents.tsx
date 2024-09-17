import {useMemo} from 'react';

import {dedupeArray} from 'sentry/utils/dedupeArray';

import {useGroupBys} from './useGroupBys';
import {useResultMode} from './useResultsMode';
import {useVisualizes} from './useVisualizes';

export const TOP_EVENTS_LIMIT: number = 5;

export function useTopEvents(): number | undefined {
  const [visualizes] = useVisualizes();
  const [groupBys] = useGroupBys();
  const [resultMode] = useResultMode();

  const yAxes = useMemo(() => {
    const deduped = dedupeArray(visualizes.flatMap(visualize => visualize.yAxes));
    deduped.sort();
    return deduped;
  }, [visualizes]);

  const topEvents: number | undefined = useMemo(() => {
    if (resultMode === 'samples') {
      return undefined;
    }

    // We only support top events for a single chart with no overlaps in aggregate mode and
    // the data must be grouped by at least one field
    return yAxes.length > 1 || (groupBys.length === 1 && groupBys[0] === '')
      ? undefined
      : TOP_EVENTS_LIMIT;
  }, [yAxes, groupBys, resultMode]);

  return topEvents;
}
