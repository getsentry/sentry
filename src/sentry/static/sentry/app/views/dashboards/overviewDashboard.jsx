import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';

import Dashboard from './dashboard';
import overviewDashboard from './data/dashboards/overviewDashboard';

class OverviewDashboard extends AsyncView {
  getEndpoints() {
    return [['releases', `/organizations/${this.props.params.orgId}/releases/`]];
  }

  getTitle() {
    return t('Dashboard - %s', this.props.params.orgId);
  }

  renderLoading() {
    // We don't want a loading state
    return this.renderBody();
  }

  renderBody() {
    // Passing the rest of `this.props` to `<Dashboard>` for tests
    const {router, ...props} = this.props;

    return (
      <Dashboard
        releases={this.state.releases}
        releasesLoading={this.state.loading}
        router={router}
        {...overviewDashboard}
        {...props}
      />
    );
  }
}
export default OverviewDashboard;
