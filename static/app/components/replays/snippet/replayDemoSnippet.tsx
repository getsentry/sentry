import {StaticNoSkipReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import ReplayLoadingState from 'sentry/components/replays/snippet/replayLoadingState';
import ReplayPlayback from 'sentry/components/replays/snippet/replayPlayback';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';

type ClipWindow = {
  // When to stop the replay, given it continues into that time
  endTimestampMs: number;

  // When to start the replay, given its start time is early enough
  startTimestampMs: number;
};

interface Props {
  // Replay slug may include the project... this will be parsed by useLoadReplayReader
  replaySlug: string;

  // Whether we should be only showing a portion of the replay or not, and how much
  clipWindow?: ClipWindow;
}

export default function ReplayDemoSnippet({clipWindow, replaySlug}: Props) {
  return (
    <ReplayPreferencesContextProvider prefsStrategy={StaticNoSkipReplayPreferences}>
      <ReplayPlayerPluginsContextProvider>
        <ReplayLoadingState clipWindow={clipWindow} replaySlug={replaySlug}>
          {({replay}) => (
            <ReplayReaderProvider replay={replay}>
              <ReplayPlayerStateContextProvider>
                <ReplayPlayback />
              </ReplayPlayerStateContextProvider>
            </ReplayReaderProvider>
          )}
        </ReplayLoadingState>
      </ReplayPlayerPluginsContextProvider>
    </ReplayPreferencesContextProvider>
  );
}
