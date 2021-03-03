import React from 'react';

import FeatureDisabled from 'app/components/acl/featureDisabled';

export default {
  title: 'UI/FeatureDisabled',
};

export const BasicStyle = () => (
  <FeatureDisabled
    featureName="Example Feature"
    features={['organization:example-feature', 'organization:example-feature-2']}
  />
);

BasicStyle.storyName = 'basic style';
BasicStyle.parameters = {
  docs: {
    description: {
      story: 'A disabled feature component',
    },
  },
};

export const AlertStyle = () => (
  <FeatureDisabled
    featureName="Example Feature"
    features={['organization:example-feature']}
    alert
  />
);

AlertStyle.storyName = 'alert style';
AlertStyle.parameters = {
  docs: {
    description: {
      story: 'A disabled feature wrapped in an alert',
    },
  },
};
