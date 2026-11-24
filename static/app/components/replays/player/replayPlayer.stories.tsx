import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import {ReplayPreferenceDropdown} from 'sentry/components/replays/preferences/replayPreferenceDropdown';
import {StructuredData} from 'sentry/components/structuredEventData';
import * as Storybook from 'sentry/stories';
import {useReplayPlayerState} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';

import {JumpToOffsetButtonBar} from './__stories__/jumpToOffsetButtonBar';
import {ReplaySlugChooser} from './__stories__/replaySlugChooser';
import {ReplayCurrentTime} from './replayCurrentTime';
import {ReplayPlayer} from './replayPlayer';
import {ReplayPlayerMeasurer} from './replayPlayerMeasurer';
import {ReplayPlayPauseButton} from './replayPlayPauseButton';

export default Storybook.story('ReplayPlayer', story => {
  story('Default', () => {
    function Example() {
      return (
        <Storybook.SideBySide>
          <ReplayPlayPauseButton />
          <ReplayCurrentTime />
          <ReplayPreferenceDropdown speedOptions={[0.5, 1, 2, 8]} />
          <JumpToOffsetButtonBar intervals={['0m', '1ms', '1m', '8m', '12m']} />
          <DebugReplayPlayerState />
          <DebugReplayPrefsState />
          <NegativeSpaceContainer style={{height: 500}}>
            <ReplayPlayerMeasurer>
              {style => <ReplayPlayer style={style} />}
            </ReplayPlayerMeasurer>
          </NegativeSpaceContainer>
        </Storybook.SideBySide>
      );
    }
    return (
      <ReplaySlugChooser>
        <Example />
      </ReplaySlugChooser>
    );
  });
});

function DebugReplayPlayerState() {
  const state = useReplayPlayerState();
  return <StructuredData value={state} maxDefaultDepth={1} withAnnotatedText={false} />;
}

function DebugReplayPrefsState() {
  const [prefs] = useReplayPrefs();
  return <StructuredData value={prefs} maxDefaultDepth={1} withAnnotatedText={false} />;
}
