import React from 'react';
import Reflux from 'reflux';

import OrganizationsStore from '../stores/organizationsStore';

const withOrganizations = WrappedComponent =>
  React.createClass({
    mixins: [Reflux.connect(OrganizationsStore, 'organizations')],
    render() {
      return (
        <WrappedComponent organizations={this.state.organizations} {...this.props} />
      );
    },
  });

export default withOrganizations;
