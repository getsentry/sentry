import {useEffect, useMemo} from 'react';

import {useReplayPlayerState} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import useRAF from 'sentry/utils/useRAF';

interface Props {
  callback?: (props: {timeMs: number}) => void;
}

export default function useReplayCurrentTime(props: Props) {
  const {callback} = props || {};

  const {isFinished, playerState, replayers} = useReplayPlayerState();
  const replayer = replayers.at(0);
  const state = replayer?.service.state;

  useRAF(
    () => {
      if (callback && replayer) {
        callback({timeMs: replayer.getCurrentTime()});
      }
    },
    {enabled: Boolean(replayer) && playerState === 'playing'}
  );

  useEffect(() => {
    if (
      callback &&
      state?.value === 'paused' &&
      state?.context.timeOffset !== undefined
    ) {
      callback({
        timeMs:
          isFinished && replayer ? replayer?.getCurrentTime() : state?.context.timeOffset,
      });
    }
  }, [callback, replayer, state?.value, state?.context.timeOffset, isFinished]);

  return useMemo(
    () => ({
      timeMs: () => replayers.at(0)?.getCurrentTime(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
}
