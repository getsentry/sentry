import {useEffect} from 'react';

import useReplayPlayerState from 'sentry/utils/replays/playback/providers/useReplayPlayerState';
import useRAF from 'sentry/utils/useRAF';

interface Props {
  callback: (props: {timeMs: number}) => void;
}

export default function useReplayCurrentTime({callback}: Props) {
  const {isFinished, playerState, replayers} = useReplayPlayerState();
  const replayer = replayers.at(0);
  const state = replayer?.service.state;

  useRAF(
    () => {
      if (replayer) {
        callback({timeMs: replayer.getCurrentTime()});
      }
    },
    {enabled: Boolean(replayer) && playerState === 'playing'}
  );

  useEffect(() => {
    if (state?.value === 'paused' && state?.context.timeOffset !== undefined) {
      if (isFinished && replayer) {
        callback({timeMs: replayer?.getCurrentTime()});
      } else {
        callback({timeMs: state?.context.timeOffset});
      }
    }
  }, [callback, replayer, state?.value, state?.context.timeOffset, isFinished]);

  return {
    timeMs: () => replayer?.getCurrentTime(),
  };
}
