import {useState} from 'react';

import type ReplayReader from 'sentry/utils/replays/replayReader';

type Props = {
  replayReader: ReplayReader | null;
};

function useIsLive({replayReader}: Props) {
  const [isLive, setIsLive] = useState<boolean>(replayReader?.getIsLive() ?? false);

  if (isLive && replayReader) {
    setTimeout(
      () => {
        setIsLive(false);
      },
      replayReader.getStartTimestampMs() + 60 * 60 * 1000 - Date.now()
    );
  }

  return isLive;
}

export default useIsLive;
