import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import {IconFire} from 'app/icons';
import OnboardingPanel from 'app/components/onboardingPanel';

storiesOf('UI|OnboardingPanel', module).add(
  'default',
  withInfo('Panel with icon image.')(() => {
    return (
      <OnboardingPanel image={<IconFire size="200px" />}>
        <h3>A title</h3>
        <p>Some content to show in the onboarding state.</p>
      </OnboardingPanel>
    );
  })
);
