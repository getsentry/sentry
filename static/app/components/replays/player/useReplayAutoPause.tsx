import {useEffect} from 'react';

import {
  useReplayPlayerState,
  useReplayUserAction,
} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';

export default function useReplayAutoPause() {
  const userAction = useReplayUserAction();
  const {playerState} = useReplayPlayerState();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' && playerState === 'playing') {
        userAction({type: 'pause'});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [playerState, userAction]);
}
