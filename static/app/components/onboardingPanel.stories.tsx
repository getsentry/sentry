import {Fragment} from 'react';

import emptyStateImg from 'sentry-images/spot/feedback-empty-state.svg';

import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';

import {OnboardingPanel} from 'sentry/components/onboardingPanel';
import * as Storybook from 'sentry/stories';

export default Storybook.story('OnboardingPanel', story => {
  story('Basics', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="OnboardingPanel" /> component is used for creating
          an empty state layout or onboarding display. It can be used to show an empty
          state illustration side-by-side with onboarding content.
        </p>
        <p>
          An example <Storybook.JSXNode name="OnboardingPanel" /> with an illustration
          looks like this:
        </p>

        <Storybook.Demo resizable>
          <OnboardingPanel
            illustration={<Image src={emptyStateImg} width="150px" alt="" />}
            title="What do users think?"
            description="You can't read minds. At least we hope not. Ask users for feedback on the impact of their crashes or bugs and you shall receive."
            action={
              <Fragment>
                <Button variant="primary">Read the Docs</Button>
                <Button>See an Example</Button>
              </Fragment>
            }
          />
        </Storybook.Demo>

        <p>
          The onboarding content is specified through the title, description, and action
          props of the component.
        </p>
      </Fragment>
    );
  });

  story('Without an illustration', () => {
    return (
      <Fragment>
        <p>
          You're not required to specify an{' '}
          <Storybook.JSXProperty name="illustration" value /> with this component.
        </p>
        <OnboardingPanel
          title="What do users think?"
          description="You can't read minds. At least we hope not. Ask users for feedback on the impact of their crashes or bugs and you shall receive."
          action={
            <Fragment>
              <Button variant="primary">Read the Docs</Button>
              <Button>See an Example</Button>
            </Fragment>
          }
        />
      </Fragment>
    );
  });
});
