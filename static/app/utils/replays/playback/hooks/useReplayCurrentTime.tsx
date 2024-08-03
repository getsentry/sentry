import {useEffect, useMemo} from 'react';

import useReplayPlayerState from 'sentry/utils/replays/playback/providers/useReplayPlayerState';
import useRAF from 'sentry/utils/useRAF';

interface Props {
  callback: (props: number) => void;
}

/**
 * The basic way to use this hook+callback is to set state in the component:
 * ```
 * const [currentTime, setCurrentTime] = useState(0);
 * useReplayCurrentTime({callback: setCurrentTime});
 * ```
 * or just call the returned getter:
 * ```
 * const currentTime = useReplayCurrentTime().get()
 * ```
 *
 * For perf we could/should look at ways to update calculated state values
 * inside the callback, or manipulate css directly without using react.
 */
export default function useReplayCurrentTime(props?: Props) {
  const callback = props?.callback;
  const {isFinished, playerState, replayers, startTimeOffsetMs} = useReplayPlayerState();
  const replayer = replayers.at(0);
  const state = replayer?.service.state;

  useRAF(
    () => {
      if (replayer) {
        callback?.(replayer.getCurrentTime() - startTimeOffsetMs);
      }
    },
    {enabled: callback && replayer ? playerState === 'playing' : false}
  );

  useEffect(() => {
    if (!callback) {
      return;
    }
    if (state?.value === 'paused' && state?.context.timeOffset !== undefined) {
      if (isFinished && replayer) {
        callback(replayer.getCurrentTime() - startTimeOffsetMs);
      } else {
        callback(state.context.timeOffset - startTimeOffsetMs);
      }
    }
  }, [callback, replayer, state, isFinished, startTimeOffsetMs]);

  return useMemo(
    () => ({
      get: () => (replayer ? replayer.getCurrentTime() - startTimeOffsetMs : undefined),
    }),
    [replayer, startTimeOffsetMs]
  );
}
