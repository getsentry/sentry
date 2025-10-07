import {useEffect, useState} from 'react';

import type ReplayReader from 'sentry/utils/replays/replayReader';
import useTimeout from 'sentry/utils/useTimeout';

type Props = {
  replayReader: ReplayReader | null;
};

export default function useIsLive({replayReader}: Props) {
  const [isLive, setIsLive] = useState<boolean>(replayReader?.getIsLive() ?? false);

  let TIME_UNTIL_NOT_LIVE_MS = 0;

  if (replayReader) {
    const TIME_UNTIL_REPLAY_FINISHED_MS =
      replayReader.getStartTimestampMs() + 60 * 60 * 1000 - Date.now();
    if (TIME_UNTIL_REPLAY_FINISHED_MS > 0) {
      TIME_UNTIL_NOT_LIVE_MS = TIME_UNTIL_REPLAY_FINISHED_MS;
    }
  }

  const {start: startTimeout, cancel: cancelTimeout} = useTimeout({
    timeMs: TIME_UNTIL_NOT_LIVE_MS,
    onTimeout: () => {
      setIsLive(false);
    },
  });

  useEffect(() => {
    startTimeout();

    return () => {
      cancelTimeout();
    };
  }, [cancelTimeout, startTimeout]);

  return isLive;
}
