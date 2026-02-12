import {useEffect, useMemo} from 'react';
import type {Virtualizer} from '@tanstack/react-virtual';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {getPrevReplayFrame} from 'sentry/utils/replays/getReplayEvent';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Opts {
  frames: undefined | ReplayFrame[];
  virtualizer: Virtualizer<HTMLDivElement, Element> | null;
}

function useScrollToCurrentItem({frames, virtualizer}: Opts) {
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
    if (virtualizer && currentItem && frames) {
      const index = frames.indexOf(currentItem);
      if (index >= 0) {
        // Center the current item in the viewport
        virtualizer.scrollToIndex(index, {align: 'center', behavior: 'smooth'});
      }
    }
  }, [frames, currentItem, virtualizer]);
}

export default useScrollToCurrentItem;
