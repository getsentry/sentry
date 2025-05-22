import {useState} from 'react';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import useReplayCurrentTime from 'sentry/utils/replays/playback/hooks/useReplayCurrentTime';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import useOrganization from 'sentry/utils/useOrganization';

export default function ReplayCurrentTime() {
  const organization = useOrganization();
  if (organization.features.includes('replay-new-context')) {
    return <ReplayCurrentTimeNew />;
  }

  return <OriginalReplayCurrentTime />;
}

function ReplayCurrentTimeNew() {
  const [currentTime, setCurrentTime] = useState({timeMs: 0});

  useReplayCurrentTime({callback: setCurrentTime});

  return <Duration duration={[currentTime.timeMs, 'ms']} precision="sec" />;
}

function OriginalReplayCurrentTime() {
  const {currentTime, replay} = useReplayContext();
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;
  const startTimestamp = replay?.getStartTimestampMs() ?? 0;

  return timestampType === 'absolute' ? (
    <DateTime timeOnly seconds date={startTimestamp + currentTime} />
  ) : (
    <Duration duration={[currentTime, 'ms']} precision="sec" />
  );
}
