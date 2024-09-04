import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ObjectInspector from 'sentry/components/objectInspector';
import JumpToOffsetButtonBar from 'sentry/components/replays/player/__stories__/jumpToOffsetButtonBar';
import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import ReplayCurrentTime from 'sentry/components/replays/player/replayCurrentTime';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import ReplayPlayPauseButton from 'sentry/components/replays/player/replayPlayPauseButton';
import ReplayPreferenceDropdown from 'sentry/components/replays/preferences/replayPreferenceDropdown';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';
import useReplayPlayerState from 'sentry/utils/replays/playback/providers/useReplayPlayerState';
import useReplayPrefs from 'sentry/utils/replays/playback/providers/useReplayPrefs';

export default storyBook(ReplayPlayer, story => {
  story('Default', () => {
    function Example() {
      return (
        <SideBySide>
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
        </SideBySide>
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
  return <ObjectInspector data={state} expandLevel={1} />;
}

function DebugReplayPrefsState() {
  const [prefs] = useReplayPrefs();
  return <ObjectInspector data={prefs} expandLevel={1} />;
}
