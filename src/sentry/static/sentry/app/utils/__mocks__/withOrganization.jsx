import React from 'react';

import SentryTypes from 'app/sentryTypes';

const withOrganizationMock = WrappedComponent =>
  class WithOrganizationMockWrappeer extends React.Component {
    static contextTypes = {
      organization: SentryTypes.Organization,
    };
    render() {
      return (
        <WrappedComponent
          organization={this.context.organization || TestStubs.Organization()}
          {...this.props}
        />
      );
    }
  };

export default withOrganizationMock;
