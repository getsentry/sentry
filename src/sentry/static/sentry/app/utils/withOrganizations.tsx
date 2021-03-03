import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import OrganizationsStore from 'app/stores/organizationsStore';
import {OrganizationSummary} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

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
      const {organizationsLoading, organizations, ...props} = this.props as P;
      return (
        <WrappedComponent
          {...({
            organizationsLoading: organizationsLoading ?? !OrganizationsStore.loaded,
            organizations: organizations ?? this.state.organizations,
            ...props,
          } as P)}
        />
      );
    },
  });

export default withOrganizations;
