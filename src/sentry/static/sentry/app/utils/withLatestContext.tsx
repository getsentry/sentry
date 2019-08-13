import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import ConfigStore from 'app/stores/configStore';
import LatestContextStore from 'app/stores/latestContextStore';
import SentryTypes from 'app/sentryTypes';
import getDisplayName from 'app/utils/getDisplayName';
import withOrganizations from 'app/utils/withOrganizations';
import {Project, Organization} from 'app/types';

const withLatestContext = <P extends object>(WrappedComponent: React.ComponentType<P>) =>
  withOrganizations(
    createReactClass({
      displayName: `withLatestContext(${getDisplayName(WrappedComponent)})`,
      propTypes: {
        organizations: PropTypes.arrayOf(SentryTypes.Organization),
      },
      mixins: [Reflux.connect(LatestContextStore, 'latestContext')],

      render() {
        const {organizations} = this.props;
        const {latestContext} = this.state;
        const {
          organization,
          project,
          lastRoute,
        }: {organization?: Organization; project?: Project; lastRoute?: string} =
          latestContext || {};

        // Even though org details exists in LatestContextStore,
        // fetch organization from OrganizationsStore so that we can
        // expect consistent data structure because OrganizationsStore has a list
        // of orgs but not full org details
        const latestOrganization =
          organization ||
          (organizations && organizations.length
            ? organizations.find(
                ({slug}) => slug === ConfigStore.get('lastOrganization')
              ) || organizations[0]
            : null);

        // TODO(billy): Below is going to be wrong if component is passed project, it will override
        // project from `latestContext`
        return (
          <WrappedComponent
            organizations={organizations as Organization[]}
            organization={latestOrganization as Organization}
            project={project as Project}
            lastRoute={lastRoute as string}
            {...this.props as P}
          />
        );
      },
    })
  );

export default withLatestContext;
