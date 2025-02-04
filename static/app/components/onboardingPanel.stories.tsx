import {Fragment} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/feedback-empty-state.svg';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('OnboardingPanel', story => {
  story('Basics', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="OnboardingPanel" /> component is used for creating an empty
          state layout or onboarding display. It can be used to show an empty state image
          side-by-side with onboarding content.
        </p>
        <p>
          An example <JSXNode name="OnboardingPanel" /> with an image looks like this:
        </p>

        <OnboardingPanel image={<img src={emptyStateImg} />}>
          <h3>What do users think?</h3>
          <p>
            You can't read minds. At least we hope not. Ask users for feedback on the
            impact of their crashes or bugs and you shall receive.
          </p>
          <ButtonList gap={1}>
            <Button priority="primary">Read the Docs</Button>
            <Button>See an Example</Button>
          </ButtonList>
        </OnboardingPanel>

        <p>
          The onboarding content on the right here is specified through the children of
          the component.
        </p>
        <p>The panel also automatically resizes correctly for narrow screens:</p>
        <SizingWindow>
          <OnboardingPanel image={<img src={emptyStateImg} />}>
            <h3>What do users think?</h3>
            <p>
              You can't read minds. At least we hope not. Ask users for feedback on the
              impact of their crashes or bugs and you shall receive.
            </p>
          </OnboardingPanel>
        </SizingWindow>
      </Fragment>
    );
  });

  story('Without an image', () => {
    return (
      <Fragment>
        <p>
          You're not required to specify an <JSXProperty name="image" value /> with this
          component, in which case your <JSXNode name="OnboardingPanel" /> might look
          something like this.
        </p>
        <p>
          Here, we've specified the optional property
          <JSXProperty name="noCenter" value="true" />, which makes the content
          left-aligned. Note that the <JSXProperty name="noCenter" value /> prop is only
          valid if there isn't an image specified!
        </p>
        <OnboardingPanel noCenter>
          <h3>What do users think?</h3>
          <p>
            You can't read minds. At least we hope not. Ask users for feedback on the
            impact of their crashes or bugs and you shall receive.
          </p>
          <ButtonList gap={1}>
            <Button priority="primary">Read the Docs</Button>
            <Button>See an Example</Button>
          </ButtonList>
        </OnboardingPanel>
      </Fragment>
    );
  });
});

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;
