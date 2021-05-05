import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import {EMPTY_DASHBOARD} from './data';
import DashboardDetail from './detail';
import {DashboardState} from './types';
import {cloneDashboard} from './utils';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  organization: Organization;
  children: React.ReactNode;
};

class CreateDashboard extends React.Component<Props> {
  render() {
    const {organization, route, ...props} = this.props;
    const dashboard = cloneDashboard(EMPTY_DASHBOARD);
    return (
      <DashboardDetail
        {...props}
        organization={organization}
        initialState={DashboardState.CREATE}
        dashboard={dashboard}
        dashboards={[]}
        route={route}
      />
    );
  }
}

export default withOrganization(CreateDashboard);
