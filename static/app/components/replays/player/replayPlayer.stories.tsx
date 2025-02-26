import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import JumpToOffsetButtonBar from 'sentry/components/replays/player/__stories__/jumpToOffsetButtonBar';
import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import ReplayCurrentTime from 'sentry/components/replays/player/replayCurrentTime';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import ReplayPlayPauseButton from 'sentry/components/replays/player/replayPlayPauseButton';
import ReplayPreferenceDropdown from 'sentry/components/replays/preferences/replayPreferenceDropdown';
import {StructuredData} from 'sentry/components/structuredEventData';
import StoryBook from 'sentry/stories/storyBook';
import {useReplayPlayerState} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';

export default StoryBook('ReplayPlayer', Story => {
  Story('Default', () => {
    function Example() {
      return (
        <Story.SideBySide>
          <ReplayPlayPauseButton />
          <ReplayCurrentTime />
          <ReplayPreferenceDropdown speedOptions={[0.5, 1, 2, 8]} />
          <JumpToOffsetButtonBar intervals={['0m', '1ms', '1m', '8m', '12m']} />
          <DebugReplayPlayerState />
          <DebugReplayPrefsState />
          <NegativeSpaceContainer style={{height: 500}}>
            <ReplayPlayerMeasurer measure="both">
              {style => <ReplayPlayer style={style} />}
            </ReplayPlayerMeasurer>
          </NegativeSpaceContainer>
        </Story.SideBySide>
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
