import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import OrganizationsStore from 'app/stores/organizationsStore';

const withOrganizations = WrappedComponent =>
  createReactClass({
    displayName: 'withOrganizations',
    mixins: [Reflux.connect(OrganizationsStore, 'organizations')],

    render() {
      return (
        <WrappedComponent organizations={this.state.organizations} {...this.props} />
      );
    },
  });

export default withOrganizations;
