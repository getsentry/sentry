import FeatureDisabled from 'sentry/components/acl/featureDisabled';

export default {
  title: 'Components/Alerts/Feature Disabled',
};

export const BasicStyle = () => (
  <FeatureDisabled
    featureName="Example Feature"
    features={['organization:example-feature', 'organization:example-feature-2']}
  />
);

BasicStyle.storyName = 'Basic Style';
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

AlertStyle.storyName = 'Alert Style';
AlertStyle.parameters = {
  docs: {
    description: {
      story: 'A disabled feature wrapped in an alert',
    },
  },
};
