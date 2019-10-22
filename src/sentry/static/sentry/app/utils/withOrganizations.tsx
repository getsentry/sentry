import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import OrganizationsStore from 'app/stores/organizationsStore';
import {Organization} from 'app/types';

type InjectedOrganizationsProps = {
  organizationsLoading?: boolean;
  organizations: Organization[];
};

type State = {
  organizations: Organization[];
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
      return (
        <WrappedComponent
          organizationsLoading={!OrganizationsStore.loaded as boolean}
          organizations={this.state.organizations as Organization[]}
          {...this.props as P}
        />
      );
    },
  });

export default withOrganizations;
