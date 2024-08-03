import {useLayoutEffect, useState} from 'react';

import useReplayCurrentTime from 'sentry/utils/replays/playback/hooks/useReplayCurrentTime';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';
import {replayPlayerTimestampEmitter} from 'sentry/utils/replays/replayPlayerTimestampEmitter';

/**
 * @deprecated This emitter sends some global state through a singleton.
 * If there are multiple replay instances on the page values will be confusing.
 * A better implementation would nest the consumer under the same
 * <ReplayCurrentTimeContextProvider> ancestor node.
 */
export default function useEmitTimestampChanges() {
  const [currentTime, handleCurrentTime] = useState(0);
  useReplayCurrentTime({callback: handleCurrentTime});
  const [currentHoverTime] = useCurrentHoverTime();

  useLayoutEffect(() => {
    replayPlayerTimestampEmitter.emit('replay timestamp change', {
      currentTime,
      currentHoverTime,
    });
  }, [currentTime, currentHoverTime]);
}
