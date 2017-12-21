import React from 'react';
import Reflux from 'reflux';

import LatestContextStore from '../stores/latestContextStore';
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
        let {latestContext} = this.state;
        let {organization, project} = latestContext || {};

        // Even though org details exists in LatestContextStore,
        // fetch organization from OrganizationsStore so that we can
        // expect consistent data structure because OrganizationsStore has a list
        // of orgs but not full org details
        let latestOrganization =
          organization || (organizations && organizations.length && organizations[0]);

        return (
          <WrappedComponent
            organizations={organizations}
            organization={latestOrganization}
            project={project}
            {...this.props}
          />
        );
      },
    })
  );

export default withLatestContext;
