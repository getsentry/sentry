import type {ReactNode} from 'react';

import {StaticNoSkipReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {ReplayPlayerEventsContextProvider} from 'sentry/utils/replays/playback/providers/useReplayPlayerEvents';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/useReplayPlayerPlugins';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/useReplayPlayerState';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/useReplayPrefs';
import type ReplayReader from 'sentry/utils/replays/replayReader';

export default function Providers({
  children,
  replay,
}: {
  children: ReactNode;
  replay: ReplayReader;
}) {
  return (
    <ReplayPreferencesContextProvider prefsStrategy={StaticNoSkipReplayPreferences}>
      <ReplayPlayerPluginsContextProvider>
        <ReplayPlayerEventsContextProvider replay={replay}>
          <ReplayPlayerStateContextProvider>{children}</ReplayPlayerStateContextProvider>
        </ReplayPlayerEventsContextProvider>
      </ReplayPlayerPluginsContextProvider>
    </ReplayPreferencesContextProvider>
  );
}
