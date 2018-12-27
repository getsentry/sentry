import React from 'react';

import SentryTypes from 'app/sentryTypes';
import getDisplayName from 'app/utils/getDisplayName';

/**
 * Currently wraps component with organization from context
 */
const withOrganization = WrappedComponent =>
  class extends React.Component {
    static displayName = `withOrganizations(${getDisplayName(WrappedComponent)})`;
    static contextTypes = {
      organization: SentryTypes.Organization,
    };

    render() {
      return (
        <WrappedComponent organization={this.context.organization} {...this.props} />
      );
    }
  };

export default withOrganization;
