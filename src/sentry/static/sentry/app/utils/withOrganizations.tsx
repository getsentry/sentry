import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import OrganizationsStore from 'app/stores/organizationsStore';
import {OrganizationSummary} from 'app/types';

type InjectedOrganizationsProps = {
  organizationsLoading?: boolean;
  organizations: OrganizationSummary[];
};

type State = {
  organizations: OrganizationSummary[];
};

const withOrganizations = <P extends InjectedOrganizationsProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedOrganizationsProps> & Partial<InjectedOrganizationsProps>,
    State
  >({
    displayName: `withOrganizations(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.connect(OrganizationsStore, 'organizations') as any],

    render() {
      const {
        organizationsLoading = !OrganizationsStore.loaded as boolean,
        organizations = this.state.organizations,
      } = this.props as P;

      return (
        <WrappedComponent
          {...(this.props as P)}
          organizationsLoading={organizationsLoading}
          organizations={organizations}
        />
      );
    },
  });

export default withOrganizations;
