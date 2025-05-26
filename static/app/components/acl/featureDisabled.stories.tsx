import {Fragment} from 'react';

import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import * as Storybook from 'sentry/stories';

export default Storybook.story('FeatureDisabled', story => {
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The FeatureDisabled component is used to display a warning message when a user
          attempts to access a feature that is not available to them. It can show both a
          simple alert-style message as well as an expandable help section with more
          detailed information. The component supports customization of the message,
          feature name, and whether to show the help toggle. It's commonly used throughout
          the application to gracefully handle feature access restrictions and provide
          clear feedback to users about why certain functionality may be unavailable.
        </p>
        <FeatureDisabled
          features={['this-feature-does-not-exist']}
          featureName="Feature"
        />
      </Fragment>
    );
  });
});
