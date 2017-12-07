import React from 'react';
import Reflux from 'reflux';

import LatestContextStore from '../stores/latestContextStore';
import OrganizationsStore from '../stores/organizationsStore';
import withOrganizations from './withOrganizations';

// HoC that returns most usable organization + project
// This means your org if you only have 1 org, or
// last accessed organization/project
const withLatestContext = WrappedComponent =>
  withOrganizations(
    React.createClass({
      mixins: [Reflux.connect(LatestContextStore, 'latestContext')],
      render() {
        let {organizations} = this.props;
        let organization =
          (organizations && organizations.length && organizations[0]) ||
          OrganizationsStore.get(this.state.latestContext.organization);
        return (
          <WrappedComponent
            organization={organization}
            project={this.state.latestContext.project}
            {...this.props}
          />
        );
      },
    })
  );

export default withLatestContext;
