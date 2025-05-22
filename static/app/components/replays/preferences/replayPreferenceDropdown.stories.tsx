import {Fragment} from 'react';

import ReplayPreferenceDropdown from 'sentry/components/replays/preferences/replayPreferenceDropdown';
import {
  LocalStorageReplayPreferences,
  StaticNoSkipReplayPreferences,
  StaticReplayPreferences,
} from 'sentry/components/replays/preferences/replayPreferences';
import StructuredEventData from 'sentry/components/structuredEventData';
import * as Storybook from 'sentry/stories';
import {
  ReplayPreferencesContextProvider,
  useReplayPrefs,
} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';

export default Storybook.story('ReplayPreferenceDropdown', story => {
  story('Default - LocalStorageReplayPreferences', () => {
    return (
      <Fragment>
        <p>
          Most often you'll want to save preferences into localStorage using the{' '}
          <code>LocalStorageReplayPreferences</code> strategy.
        </p>
        <p>
          Each instance of the{' '}
          <Storybook.JSXNode name="ReplayPreferencesContextProvider" /> will not
          communicate with the others, but the localStorage item is shared anyway.
          Whatever instance sets the value last is the winner.
        </p>
        <ReplayPreferencesContextProvider prefsStrategy={LocalStorageReplayPreferences}>
          <Storybook.SideBySide>
            <DebugReplayPrefsState />
            <ReplayPreferenceDropdown speedOptions={[1, 2, 3]} />
          </Storybook.SideBySide>
        </ReplayPreferencesContextProvider>
      </Fragment>
    );
  });

  story('No provider', () => {
    return (
      <Fragment>
        <p>
          A parent <Storybook.JSXNode name="ReplayPreferencesContextProvider" /> is what
          allows values to be changed. Without that in the tree changes will not be
          reflected.
        </p>
        <Storybook.SideBySide>
          <DebugReplayPrefsState />
          <ReplayPreferenceDropdown speedOptions={[1, 2, 3]} />
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('StaticReplayPreferences', () => {
    return (
      <Fragment>
        <p>
          If one of the Static* strategies is used, then the values can still be changed,
          but nothing will be persisted into localStorage.
        </p>
        <h4>StaticReplayPreferences</h4>
        <ReplayPreferencesContextProvider prefsStrategy={StaticReplayPreferences}>
          <Storybook.SideBySide>
            <DebugReplayPrefsState />
            <ReplayPreferenceDropdown speedOptions={[1, 2, 3]} />
          </Storybook.SideBySide>
        </ReplayPreferencesContextProvider>
        <h4>StaticNoSkipReplayPreferences</h4>
        <ReplayPreferencesContextProvider prefsStrategy={StaticNoSkipReplayPreferences}>
          <Storybook.SideBySide>
            <DebugReplayPrefsState />
            <ReplayPreferenceDropdown speedOptions={[1, 2, 3]} />
          </Storybook.SideBySide>
        </ReplayPreferencesContextProvider>
      </Fragment>
    );
  });

  story('hideFastForward', () => {
    return (
      <Fragment>
        <p>
          You can hide the fast-forward checkbox in case that's not supported or
          desirable.
        </p>
        <ReplayPreferencesContextProvider prefsStrategy={StaticReplayPreferences}>
          <Storybook.SideBySide>
            <DebugReplayPrefsState />
            <ReplayPreferenceDropdown hideFastForward speedOptions={[1, 2, 3]} />
          </Storybook.SideBySide>
        </ReplayPreferencesContextProvider>
      </Fragment>
    );
  });
});

function DebugReplayPrefsState() {
  const [prefs] = useReplayPrefs();
  return <StructuredEventData data={prefs} maxDefaultDepth={1} forceDefaultExpand />;
}
