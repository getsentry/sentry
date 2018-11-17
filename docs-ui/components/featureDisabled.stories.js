import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import FeatureDisabled from 'app/components/acl/featureDisabled';

storiesOf('UI|FeatureDisabled', module)
  .add(
    'basic style',
    withInfo('A disabled feature component')(() => (
      <FeatureDisabled
        featureName="Example Feature"
        features={['organization:example-feature', 'organization:example-feature-2']}
      />
    ))
  )
  .add(
    'alert style',
    withInfo('A disabled feature wrapped in an alert')(() => (
      <FeatureDisabled
        featureName="Example Feature"
        features={['organization:example-feature']}
        alert
      />
    ))
  );
