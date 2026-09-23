import {useEffect, useMemo} from 'react';
import type {Virtualizer} from '@tanstack/react-virtual';

import {getPrevReplayFrame} from 'sentry/utils/replays/getReplayEvent';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Opts {
  autoScrollEnabled: boolean;
  currentTime: number;
  frames: undefined | ReplayFrame[];
  virtualizer: Pick<Virtualizer<HTMLElement, Element>, 'scrollElement' | 'scrollToIndex'>;
}

export function useScrollToCurrentItem({
  autoScrollEnabled,
  currentTime,
  frames,
  virtualizer,
}: Opts) {
  const currentItem = useMemo(
    () =>
      getPrevReplayFrame({
        frames: frames || [],
        targetOffsetMs: currentTime,
      }),
    [frames, currentTime]
  );

  useEffect(() => {
    if (autoScrollEnabled && virtualizer.scrollElement && currentItem && frames) {
      const index = frames.indexOf(currentItem);
      if (index >= 0) {
        // Center the current item in the viewport
        virtualizer.scrollToIndex(index, {align: 'center', behavior: 'smooth'});
      }
    }
  }, [autoScrollEnabled, frames, currentItem, virtualizer]);
}
