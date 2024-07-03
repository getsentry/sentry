import {Fragment} from 'react';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerContainment from 'sentry/components/replays/player/replayPlayerContainment';
import ReplayPlayPauseButton from 'sentry/components/replays/player/replayPlayPauseButton';
import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(ReplayPlayer, story => {
  story('Default', () => {
    function Example() {
      return (
        <Fragment>
          <p>
            Include <JSXNode name="ReplayPlayPauseButton" /> inside a{' '}
            <JSXNode name="ReplayPlayerStateContextProvider" /> to control the play/pause
            state of the replay.
          </p>

          <NegativeSpaceContainer style={{height: 400}}>
            <ReplayPlayerContainment measure="both">
              {style => <ReplayPlayer style={style} />}
            </ReplayPlayerContainment>
          </NegativeSpaceContainer>
          <ReplayPlayPauseButton />
        </Fragment>
      );
    }
    return (
      <ReplaySlugChooser>
        <Example />
      </ReplaySlugChooser>
    );
  });

  story('Multiple Players', () => {
    function Example() {
      return (
        <Fragment>
          <p>
            All <JSXNode name="ReplayPlayer" /> instances within the{' '}
            <JSXNode name="ReplayPlayerStateContextProvider" /> will play & pause
            together.
          </p>

          <NegativeSpaceContainer style={{height: 200}}>
            <ReplayPlayerContainment measure="both">
              {style => <ReplayPlayer style={style} />}
            </ReplayPlayerContainment>
          </NegativeSpaceContainer>
          <hr />
          <NegativeSpaceContainer style={{height: 200}}>
            <ReplayPlayerContainment measure="both">
              {style => <ReplayPlayer style={style} />}
            </ReplayPlayerContainment>
          </NegativeSpaceContainer>
          <ReplayPlayPauseButton />
        </Fragment>
      );
    }
    return (
      <ReplaySlugChooser>
        <Example />
      </ReplaySlugChooser>
    );
  });
});
