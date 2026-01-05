import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import onboardingFrameworkSelectionJavascript from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import ClippedBox from 'sentry/components/clippedBox';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

export default Storybook.story('ClippedBox', story => {
  story('Default', () => (
    <Fragment>
      <p>
        By default <Storybook.JSXNode name="ClippedBox" /> is just a container. Add{' '}
        <Storybook.JSXProperty name="defaultClipped" value /> to occlude the bottom part
        of the content if the content height is larger than{' '}
        <Storybook.JSXProperty name="clipHeight" value={Number} />. You should also set{' '}
        <Storybook.JSXProperty name="clipHeight" value={Number} /> (default: 300) to be
        something reasonable for the situation.
      </p>
      <p>
        Once expanded, <Storybook.JSXNode name="ClippedBox" /> cannot be collapsed again.
      </p>
      <Storybook.SizingWindow>
        <ClippedBox>
          <img src={onboardingFrameworkSelectionJavascript} height={300} />
        </ClippedBox>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  const CustomFade = styled('div')`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: ${space(1)};
    background: ${p => p.theme.tokens.background.primary};
    text-align: center;
    pointer-events: none;
  `;

  story('Title', () => (
    <Storybook.SizingWindow>
      <ClippedBox title="This is the title">
        <img src={onboardingFrameworkSelectionJavascript} height={300} />
      </ClippedBox>
    </Storybook.SizingWindow>
  ));

  story('Custom Button & Fade', () => (
    <Storybook.PropMatrix
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

  story('Callbacks', () => {
    return (
      <Fragment>
        <p>
          Some callbacks are available:{' '}
          <Storybook.JSXProperty name="onSetRenderedHeight" value={Function} />&{' '}
          <Storybook.JSXProperty name="onReveal" value={Function} />.
        </p>
        <Storybook.SideBySide>
          {[50, 100, 150].map(imgHeight => {
            const [isRevealed, setIsRevealed] = useState(false);
            const [renderedHeight, setRenderedHeight] = useState<number | undefined>(
              undefined
            );
            return (
              <div key={imgHeight}>
                <p>
                  <Storybook.JSXNode name="ClippedBox" props={{clipHeight: 100}}>
                    <Storybook.JSXNode name="img" props={{height: imgHeight}} />
                  </Storybook.JSXNode>
                </p>
                <p>isRevealed = {String(isRevealed)}</p>
                <p>renderedHeight = {renderedHeight}</p>
                <Storybook.SizingWindow>
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
                </Storybook.SizingWindow>
              </div>
            );
          })}
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});
