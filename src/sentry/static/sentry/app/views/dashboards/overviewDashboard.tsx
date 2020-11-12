import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import {Release} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';
import DashboardDetail from 'app/views/dashboardsV2/detail';

import Dashboard from './dashboard';
import overviewDashboard from './data/dashboards/overviewDashboard';

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

function DashboardLanding(props) {
  const {organization, ...restProps} = props;

  const showDashboardV2 = organization.features.includes('dashboards-v2');

  if (showDashboardV2) {
    return <DashboardDetail {...restProps} />;
  }

  return <OverviewDashboard {...restProps} />;
}

DashboardLanding.propTypes = {
  organization: SentryTypes.Organization,
};

export default withOrganization(DashboardLanding);
