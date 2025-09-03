import {type ReactNode} from 'react';

import {LocalStorageReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';
import {ReplayPreferencesContextProvider} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';

interface Props {
  children: ReactNode;
}

export default function ReplayListProviders({children}: Props) {
  return (
    <ReplayPreferencesContextProvider prefsStrategy={LocalStorageReplayPreferences}>
      {children}
    </ReplayPreferencesContextProvider>
  );
}
