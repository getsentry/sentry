import React from 'react';

import SentryTypes from 'app/sentryTypes';

const withOrganizationEnvironmentsMock = WrappedComponent =>
  class WithOrganizationEnvironmentsMockWrapper extends React.Component {
    static contextTypes = {
      organization: SentryTypes.Organization,
    };
    render() {
      return (
        <WrappedComponent
          organizationEnvironments={
            this.context.organization.environments || TestStubs.Environments()
          }
          {...this.props}
        />
      );
    }
  };

export default withOrganizationEnvironmentsMock;
