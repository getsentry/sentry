import React from 'react';

import SentryTypes from 'app/sentryTypes';
import getDisplayName from 'app/utils/getDisplayName';
import {Organization, LightWeightOrganization} from 'app/types';

type InjectedOrganizationProps = {
  organization: Organization | LightWeightOrganization;
};

const withOrganization = <P extends InjectedOrganizationProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  class extends React.Component<
    Omit<P, keyof InjectedOrganizationProps> & Partial<InjectedOrganizationProps>
  > {
    static displayName = `withOrganization(${getDisplayName(WrappedComponent)})`;
    static contextTypes = {
      organization: SentryTypes.Organization,
    };

    render() {
      return (
        <WrappedComponent
          organization={this.context.organization as Organization}
          {...(this.props as P)}
        />
      );
    }
  };

export function isLightweightOrganization(
  organization: Organization | LightWeightOrganization
): organization is LightWeightOrganization {
  const castedOrg = organization as Organization;
  return !(castedOrg.projects && castedOrg.teams);
}

export default withOrganization;
