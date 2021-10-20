import * as React from 'react';

import SentryTypes from 'app/sentryTypes';
import {Organization} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedOrganizationProps = {
  organization?: Organization;
};

const withOrganization = <P extends InjectedOrganizationProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  class extends React.Component<
    Omit<P, keyof InjectedOrganizationProps> & InjectedOrganizationProps
  > {
    static displayName = `withOrganization(${getDisplayName(WrappedComponent)})`;
    static contextTypes = {
      organization: SentryTypes.Organization,
    };

    render() {
      const {organization, ...props} = this.props;
      return (
        <WrappedComponent
          {...({
            organization: organization ?? this.context.organization,
            ...props,
          } as P)}
        />
      );
    }
  };

export default withOrganization;
