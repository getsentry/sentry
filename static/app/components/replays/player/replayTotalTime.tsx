import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

export default function ReplayTotalTime() {
  const [prefs] = useReplayPrefs();
  const replay = useReplayReader();

  switch (prefs.timestampType) {
    case 'absolute':
      return (
        <DateTime
          date={replay.getDurationMs() + replay.getStartTimestampMs()}
          seconds
          timeOnly
        />
      );
    default:
    case 'relative':
      return <Duration duration={[replay.getDurationMs(), 'ms']} precision="sec" />;
  }
}
