import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import FeatureDisabled from 'app/components/acl/featureDisabled';

storiesOf('UI|FeatureDisabled', module)
  .add(
    'basic style',
    withInfo('A disabled feature component')(() => (
      <FeatureDisabled name="Example Feature" feature="organization:example-feature" />
    ))
  )
  .add(
    'alert style',
    withInfo('A disabled feature wrapped in an alert')(() => (
      <FeatureDisabled
        name="Example Feature"
        feature="organization:example-feature"
        alert
      />
    ))
  );
