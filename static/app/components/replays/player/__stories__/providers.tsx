import type {ReactNode} from 'react';

import {StaticNoSkipReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {ReplayBasicsProvider} from 'sentry/utils/replays/playback/providers/replayBasicsProvider';
import {ReplayPlayerEventsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerEventsContext';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
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
        <ReplayBasicsProvider replay={replay}>
          <ReplayPlayerEventsContextProvider replay={replay}>
            <ReplayPlayerStateContextProvider>
              {children}
            </ReplayPlayerStateContextProvider>
          </ReplayPlayerEventsContextProvider>
        </ReplayBasicsProvider>
      </ReplayPlayerPluginsContextProvider>
    </ReplayPreferencesContextProvider>
  );
}
