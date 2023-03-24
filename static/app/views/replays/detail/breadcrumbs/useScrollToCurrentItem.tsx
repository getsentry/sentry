import {RefObject, useEffect, useMemo} from 'react';
import type {List as ReactVirtualizedList} from 'react-virtualized';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import type {Crumb} from 'sentry/types/breadcrumbs';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';

type Opts = {
  breadcrumbs: undefined | Crumb[];
  ref: RefObject<ReactVirtualizedList>;
  startTimestampMs: number;
};
function useScrollToCurrentItem({breadcrumbs, ref, startTimestampMs}: Opts) {
  const {currentTime} = useReplayContext();
  const current = useMemo(
    () =>
      getPrevReplayEvent({
        items: breadcrumbs || [],
        targetTimestampMs: startTimestampMs + currentTime,
        allowEqual: true,
        allowExact: true,
      }),
    [breadcrumbs, currentTime, startTimestampMs]
  );

  useEffect(() => {
    if (ref.current && current) {
      const index = breadcrumbs?.findIndex(crumb => crumb.id === current.id);
      ref.current?.scrollToRow(index);
    }
  }, [breadcrumbs, current, ref]);
}

export default useScrollToCurrentItem;
