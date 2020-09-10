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
      const {
        organization = this.context
          .organization as InjectedOrganizationProps['organization'],
      } = this.props as P;
      return <WrappedComponent {...(this.props as P)} organization={organization} />;
    }
  };

export function isLightweightOrganization(
  organization: Organization | LightWeightOrganization
): organization is LightWeightOrganization {
  const castedOrg = organization as Organization;
  return !(castedOrg.projects && castedOrg.teams);
}

export default withOrganization;
