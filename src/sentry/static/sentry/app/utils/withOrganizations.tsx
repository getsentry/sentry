import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import OrganizationsStore from 'app/stores/organizationsStore';
import {Organization} from 'app/types';

const withOrganizations = <P extends object>(WrappedComponent: React.ComponentType<P>) =>
  createReactClass({
    displayName: `withOrganizations(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.connect(OrganizationsStore, 'organizations')],

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
