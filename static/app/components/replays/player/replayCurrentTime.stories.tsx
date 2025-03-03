import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import JumpToOffsetButtonBar from 'sentry/components/replays/player/__stories__/jumpToOffsetButtonBar';
import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import ReplayCurrentTime from 'sentry/components/replays/player/replayCurrentTime';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import ReplayPlayPauseButton from 'sentry/components/replays/player/replayPlayPauseButton';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('ReplayCurrentTime', story => {
  story('Default', () => {
    function Example() {
      return (
        <SideBySide>
          <ReplayPlayPauseButton />
          <ReplayCurrentTime />
          <NegativeSpaceContainer style={{height: 300}}>
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

  story('Jumping to different times', () => {
    function Example() {
      return (
        <SideBySide>
          <ReplayPlayPauseButton />
          <ReplayCurrentTime />
          <JumpToOffsetButtonBar intervals={['0m', '1m', '12m']} />

          <NegativeSpaceContainer style={{height: 300}}>
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
