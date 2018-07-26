import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {getDisplayName} from 'app/utils/getDisplayName';
import OrganizationsStore from 'app/stores/organizationsStore';

const withOrganizations = WrappedComponent =>
  createReactClass({
    displayName: `withOrganizations(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.connect(OrganizationsStore, 'organizations')],

    render() {
      return (
        <WrappedComponent organizations={this.state.organizations} {...this.props} />
      );
    },
  });

export default withOrganizations;
