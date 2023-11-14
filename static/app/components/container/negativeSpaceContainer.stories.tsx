import {Fragment} from 'react';

import backgroundLighthouse from 'sentry-images/spot/background-lighthouse.svg';
import onboardingFrameworkSelectionJavascript from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import JSXNode from 'sentry/components/stories/jsxNode';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(NegativeSpaceContainer, story => {
  story('Empty', () => (
    <Fragment>
      <p>
        A <JSXNode name="NegativeSpaceContainer" /> is a container that will preserve the
        aspect ratio of whatever is inside it. It's a flex element, so the children are
        free to expand/contract depending on whether things like <kbd>flex-grow: 1</kbd>{' '}
        are set.
      </p>
      <p>Here's one with nothing inside it:</p>
      <NegativeSpaceContainer style={{width: '100%', height: '100px'}} />
    </Fragment>
  ));

  story('Centered in a fixed space', () => (
    <NegativeSpaceContainer style={{width: '600px', height: '200px'}}>
      <img src={backgroundLighthouse} />
    </NegativeSpaceContainer>
  ));

  story('Transparent Content', () => (
    <NegativeSpaceContainer>
      <img src={onboardingFrameworkSelectionJavascript} />
    </NegativeSpaceContainer>
  ));
});
