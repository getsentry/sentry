import React from 'react';

import SentryTypes from '../proptypes';

export default function withOrganization(WrappedComponent) {
  class WithOrganization extends React.Component {
    static contextTypes = {
      organization: SentryTypes.Organization
    };

    render() {
      let {organization} = this.context;
      return (
        <WrappedComponent
          organization={organization}
          getAccess={() => new Set(organization.access)}
          getFeatures={() => new Set(organization.features)}
          getOnboardingTasks={() => new Set(organization.onboardingTasks)}
          {...this.props}
        />
      );
    }
  }

  return WithOrganization;
}
