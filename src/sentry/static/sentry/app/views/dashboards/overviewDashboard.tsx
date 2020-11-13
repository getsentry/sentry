import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import {Release} from 'app/types';

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

export default OverviewDashboard;
