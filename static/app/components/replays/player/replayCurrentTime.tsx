import {useState} from 'react';

import Duration from 'sentry/components/duration/duration';
import useReplayCurrentTime from 'sentry/utils/replays/playback/hooks/useReplayCurrentTime';

export default function ReplayCurrentTime() {
  const [currentTime, setCurrentTime] = useState({timeMs: 0});

  useReplayCurrentTime({callback: setCurrentTime});

  return <Duration duration={[currentTime.timeMs, 'ms']} precision="sec" />;
}
