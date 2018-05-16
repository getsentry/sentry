import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import PropTypes from 'prop-types';

import SentryTypes from 'app/proptypes';
import LatestContextStore from 'app/stores/latestContextStore';
import withOrganizations from 'app/utils/withOrganizations';

// HoC that returns most usable organization + project
// This means your org if you only have 1 org, or
// last accessed organization/project
const withLatestContext = WrappedComponent =>
  withOrganizations(
    createReactClass({
      displayName: 'withLatestContext',
      propTypes: {
        organizations: PropTypes.arrayOf(SentryTypes.Organization),
      },
      mixins: [Reflux.connect(LatestContextStore, 'latestContext')],

      render() {
        let {organizations} = this.props;
        let {latestContext} = this.state;
        let {organization, project, lastRoute} = latestContext || {};

        // Even though org details exists in LatestContextStore,
        // fetch organization from OrganizationsStore so that we can
        // expect consistent data structure because OrganizationsStore has a list
        // of orgs but not full org details
        let latestOrganization =
          organization ||
          (organizations && organizations.length ? organizations[0] : null);

        // TODO(billy): Below is going to be wrong if component is passed project, it will override
        // project from `latestContext`
        return (
          <WrappedComponent
            organizations={organizations}
            organization={latestOrganization}
            project={project}
            lastRoute={lastRoute}
            {...this.props}
          />
        );
      },
    })
  );

export default withLatestContext;
