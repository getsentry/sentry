import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import * as Storybook from 'sentry/stories';

import {JumpToOffsetButtonBar} from './__stories__/jumpToOffsetButtonBar';
import {ReplaySlugChooser} from './__stories__/replaySlugChooser';
import {ReplayCurrentTime} from './replayCurrentTime';
import {ReplayPlayer} from './replayPlayer';
import {ReplayPlayerMeasurer} from './replayPlayerMeasurer';
import {ReplayPlayPauseButton} from './replayPlayPauseButton';

export default Storybook.story('ReplayCurrentTime', story => {
  story('Default', () => {
    function Example() {
      return (
        <Storybook.SideBySide>
          <ReplayPlayPauseButton />
          <ReplayCurrentTime />
          <NegativeSpaceContainer style={{height: 300}}>
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

  story('Jumping to different times', () => {
    function Example() {
      return (
        <Storybook.SideBySide>
          <ReplayPlayPauseButton />
          <ReplayCurrentTime />
          <JumpToOffsetButtonBar intervals={['0m', '1m', '12m']} />

          <NegativeSpaceContainer style={{height: 300}}>
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
