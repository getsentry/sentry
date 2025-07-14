import {Fragment} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/feedback-empty-state.svg';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import * as Storybook from 'sentry/stories';

export default Storybook.story('OnboardingPanel', story => {
  story('Basics', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="OnboardingPanel" /> component is used for creating
          an empty state layout or onboarding display. It can be used to show an empty
          state image side-by-side with onboarding content.
        </p>
        <p>
          An example <Storybook.JSXNode name="OnboardingPanel" /> with an image looks like
          this:
        </p>

        <OnboardingPanel image={<img src={emptyStateImg} />}>
          <h3>What do users think?</h3>
          <p>
            You can't read minds. At least we hope not. Ask users for feedback on the
            impact of their crashes or bugs and you shall receive.
          </p>
          <ButtonList gap="md">
            <Button priority="primary">Read the Docs</Button>
            <Button>See an Example</Button>
          </ButtonList>
        </OnboardingPanel>

        <p>
          The onboarding content on the right here is specified through the children of
          the component.
        </p>
        <p>The panel also automatically resizes correctly for narrow screens:</p>
        <Storybook.SizingWindow>
          <OnboardingPanel image={<img src={emptyStateImg} />}>
            <h3>What do users think?</h3>
            <p>
              You can't read minds. At least we hope not. Ask users for feedback on the
              impact of their crashes or bugs and you shall receive.
            </p>
          </OnboardingPanel>
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Without an image', () => {
    return (
      <Fragment>
        <p>
          You're not required to specify an <Storybook.JSXProperty name="image" value />{' '}
          with this component, in which case your{' '}
          <Storybook.JSXNode name="OnboardingPanel" /> might look something like this.
        </p>
        <p>
          Here, we've specified the optional property
          <Storybook.JSXProperty name="noCenter" value="true" />, which makes the content
          left-aligned. Note that the <Storybook.JSXProperty name="noCenter" value /> prop
          is only valid if there isn't an image specified!
        </p>
        <OnboardingPanel noCenter>
          <h3>What do users think?</h3>
          <p>
            You can't read minds. At least we hope not. Ask users for feedback on the
            impact of their crashes or bugs and you shall receive.
          </p>
          <ButtonList gap="md">
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
