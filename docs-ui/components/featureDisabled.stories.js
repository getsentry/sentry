import React from 'react';
import {withInfo} from '@storybook/addon-info';

import FeatureDisabled from 'app/components/acl/featureDisabled';

export default {
  title: 'UI/FeatureDisabled',
};

export const BasicStyle = withInfo('A disabled feature component')(() => (
  <FeatureDisabled
    featureName="Example Feature"
    features={['organization:example-feature', 'organization:example-feature-2']}
  />
));

BasicStyle.story = {
  name: 'basic style',
};

export const AlertStyle = withInfo('A disabled feature wrapped in an alert')(() => (
  <FeatureDisabled
    featureName="Example Feature"
    features={['organization:example-feature']}
    alert
  />
));

AlertStyle.story = {
  name: 'alert style',
};
