import {Fragment} from 'react';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ReplaySlugChooser from 'sentry/components/replays/player/__stories__/replaySlugChooser';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('ReplayPlayerMeasurer', story => {
  story('measure=both, the default, container has fixed height', () => {
    function Example() {
      return (
        <Fragment>
          <p>
            When the container has a fixed height and both width & height are measured,
            the replay size will be constrained in both dimensions. The result is that
            there might be extra space either beside, or above & below the replay as the
            replay maintains its ratio, but fits inside the container.
          </p>
          <p>
            If the replay was captured with a lower resolution than the container, it will
            be scaled up to a maximum of 1.5 its original size. ie: a replay was captured
            at 200x300 and the container is 400x600, the replay will be shown at 300x450
            resolution. Text will be larger than normal!
          </p>
          <p>
            <strong>Use this when the container has a fixed height</strong>
          </p>

          <NegativeSpaceContainer style={{height: 500}}>
            <ReplayPlayerMeasurer measure="both">
              {style => <ReplayPlayer style={style} />}
            </ReplayPlayerMeasurer>
          </NegativeSpaceContainer>
        </Fragment>
      );
    }
    return (
      <ReplaySlugChooser>
        <Example />
      </ReplaySlugChooser>
    );
  });

  story('measure=width', () => {
    function Example() {
      return (
        <Fragment>
          <p>
            The size of the replay can be constrained to the width of the container,
            either the page or a div.
          </p>
          <p>
            Portrait mode captures will very likely be a problem, because devices like
            iPhone have high pixel density. For these devices, the capture can be 800px
            tall or more. Zoomed to 1.5 magnification, this can result in 1,200 pixel tall
            replays!
          </p>
          <p>
            <strong>Use this when the container does not have a fixed height</strong>
          </p>
          <ReplayPlayerMeasurer measure="width">
            {style => <ReplayPlayer style={style} />}
          </ReplayPlayerMeasurer>
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
