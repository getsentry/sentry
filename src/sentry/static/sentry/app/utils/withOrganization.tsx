import React from 'react';

import SentryTypes from 'app/sentryTypes';
import getDisplayName from 'app/utils/getDisplayName';
import {Organization} from 'app/types';

const withOrganization = <P extends object>(WrappedComponent: React.ComponentType<P>) =>
  class extends React.Component<Omit<P, 'organization'>> {
    static displayName = `withOrganization(${getDisplayName(WrappedComponent)})`;
    static contextTypes = {
      organization: SentryTypes.Organization,
    };

    render() {
      return (
        <WrappedComponent
          organization={this.context.organization as Organization}
          {...this.props as P}
        />
      );
    }
  };

export default withOrganization;
