import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import JumpToOffsetButtonBar from 'sentry/components/replays/player/__stories__/jumpToOffsetButtonBar';
import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import ReplayCurrentTime from 'sentry/components/replays/player/replayCurrentTime';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import ReplayPlayPauseButton from 'sentry/components/replays/player/replayPlayPauseButton';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ReplayCurrentTime', story => {
  story('Default', () => {
    function Example() {
      return (
        <Storybook.SideBySide>
          <ReplayPlayPauseButton />
          <ReplayCurrentTime />
          <NegativeSpaceContainer style={{height: 300}}>
            <ReplayPlayerMeasurer measure="both">
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

  story('Jumping to different times', () => {
    function Example() {
      return (
        <Storybook.SideBySide>
          <ReplayPlayPauseButton />
          <ReplayCurrentTime />
          <JumpToOffsetButtonBar intervals={['0m', '1m', '12m']} />

          <NegativeSpaceContainer style={{height: 300}}>
            <ReplayPlayerMeasurer measure="both">
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
