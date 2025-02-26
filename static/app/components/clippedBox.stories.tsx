import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import onboardingFrameworkSelectionJavascript from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import ClippedBox from 'sentry/components/clippedBox';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import Matrix from 'sentry/components/stories/matrix';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import StoryBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default StoryBook('ClippedBox', Story => {
  Story('Default', () => (
    <Fragment>
      <p>
        By default <JSXNode name="ClippedBox" /> is just a container. Add{' '}
        <JSXProperty name="defaultClipped" value /> to occlude the bottom part of the
        content if the content height is larger than{' '}
        <JSXProperty name="clipHeight" value={Number} />. You should also set{' '}
        <JSXProperty name="clipHeight" value={Number} /> (default: 300) to be something
        reasonable for the situation.
      </p>
      <p>
        Once expanded, <JSXNode name="ClippedBox" /> cannot be collapsed again.
      </p>
      <SizingWindow>
        <ClippedBox>
          <img src={onboardingFrameworkSelectionJavascript} height={300} />
        </ClippedBox>
      </SizingWindow>
    </Fragment>
  ));

  const CustomFade = styled('div')`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: ${space(1)};
    background: ${p => p.theme.background};
    text-align: center;
    pointer-events: none;
  `;

  Story('Title', () => (
    <SizingWindow>
      <ClippedBox title="This is the title">
        <img src={onboardingFrameworkSelectionJavascript} height={300} />
      </ClippedBox>
    </SizingWindow>
  ));

  Story('Custom Button & Fade', () => (
    <Matrix
      render={ClippedBox}
      propMatrix={{
        btnText: ['Custom Label'],
        buttonProps: [undefined, {priority: 'danger'}],
        clipHeight: [100],
        clipFade: [
          undefined,
          ({showMoreButton}) => <CustomFade>{showMoreButton}</CustomFade>,
        ],
        children: [
          <img key="img" src={onboardingFrameworkSelectionJavascript} height={150} />,
        ],
      }}
      selectedProps={['buttonProps', 'clipFade']}
    />
  ));

  Story('Callbacks', () => {
    return (
      <Fragment>
        <p>
          Some callbacks are available:{' '}
          <JSXProperty name="onSetRenderedHeight" value={Function} />&{' '}
          <JSXProperty name="onReveal" value={Function} />.
        </p>
        <Story.SideBySide>
          {[50, 100, 150].map(imgHeight => {
            const [isRevealed, setIsRevealed] = useState(false);
            const [renderedHeight, setRenderedHeight] = useState<number | undefined>(
              undefined
            );
            return (
              <div key={imgHeight}>
                <p>
                  <JSXNode name="ClippedBox" props={{clipHeight: 100}}>
                    <JSXNode name="img" props={{height: imgHeight}} />
                  </JSXNode>
                </p>
                <p>isRevealed = {String(isRevealed)}</p>
                <p>renderedHeight = {renderedHeight}</p>
                <SizingWindow>
                  <ClippedBox
                    clipHeight={100}
                    onReveal={() => setIsRevealed(true)}
                    onSetRenderedHeight={setRenderedHeight}
                  >
                    <img
                      src={onboardingFrameworkSelectionJavascript}
                      height={imgHeight}
                    />
                  </ClippedBox>
                </SizingWindow>
              </div>
            );
          })}
        </Story.SideBySide>
      </Fragment>
    );
  });
});
