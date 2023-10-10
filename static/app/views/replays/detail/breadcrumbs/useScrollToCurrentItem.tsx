import {RefObject, useEffect, useMemo} from 'react';
import type {List as ReactVirtualizedList} from 'react-virtualized';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {getPrevReplayFrame} from 'sentry/utils/replays/getReplayEvent';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Opts {
  frames: undefined | ReplayFrame[];
  ref: RefObject<ReactVirtualizedList>;
}

function useScrollToCurrentItem({frames, ref}: Opts) {
  const {currentTime} = useReplayContext();
  const currentItem = useMemo(
    () =>
      getPrevReplayFrame({
        frames: frames || [],
        targetOffsetMs: currentTime,
      }),
    [frames, currentTime]
  );

  useEffect(() => {
    if (ref.current && currentItem) {
      const index = frames?.findIndex(frame => frame === currentItem);
      ref.current?.scrollToRow(index ? index + 1 : undefined);
    }
  }, [frames, currentItem, ref]);
}

export default useScrollToCurrentItem;
