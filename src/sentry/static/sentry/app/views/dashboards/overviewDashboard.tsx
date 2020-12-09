import React from 'react';
import {RouteComponentProps} from 'react-router';

import {t} from 'app/locale';
import {Organization, Release} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import DashboardDetail from 'app/views/dashboardsV2/detail';

import overviewDashboard from './data/dashboards/overviewDashboard';
import Dashboard from './dashboard';

type Props = RouteComponentProps<{orgId: string}, {}>;

type State = {
  releases: Array<Release> | null;
} & AsyncView['state'];

class OverviewDashboard extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    const {orgId} = params;

    return [['releases', `/organizations/${orgId}/releases/`]];
  }

  getTitle() {
    const {params} = this.props;
    const {orgId} = params;

    return `${t('Dashboard')} - ${orgId}`;
  }

  renderLoading() {
    // We don't want a loading state
    return this.renderBody();
  }

  renderBody() {
    const {loading, releases} = this.state;

    if (!releases) {
      return null;
    }

    // Passing the rest of `this.props` to `<Dashboard>` for tests
    const {router, ...props} = this.props;

    return (
      <Dashboard
        releases={releases}
        releasesLoading={loading}
        router={router}
        {...overviewDashboard}
        {...props}
      />
    );
  }
}

type DashboardLandingProps = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

function DashboardLanding(props: DashboardLandingProps) {
  const {organization, params, ...restProps} = props;

  const showDashboardV2 = organization.features.includes('dashboards-v2');

  if (showDashboardV2) {
    const updatedParams = {...params, dashboardId: ''};
    return <DashboardDetail {...restProps} params={updatedParams} />;
  }

  return <OverviewDashboard {...restProps} params={params} />;
}

export default withOrganization(DashboardLanding);
