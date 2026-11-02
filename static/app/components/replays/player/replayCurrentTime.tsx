import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration/duration';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

export function ReplayCurrentTime() {
  const replay = useReplayReader();
  const {currentTime} = useReplayContext();
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;
  const startTimestamp = replay?.getStartTimestampMs() ?? 0;

  return timestampType === 'absolute' ? (
    <DateTime timeOnly seconds date={startTimestamp + currentTime} />
  ) : (
    <Duration duration={[currentTime, 'ms']} precision="sec" />
  );
}
