import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Dashboard from 'app/views/organizationDashboard/dashboard';
import overviewDashboard from 'app/views/organizationDashboard/data/dashboards/overviewDashboard';

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
    return <Dashboard releases={this.state.releases} {...overviewDashboard} />;
  }
}
export default OverviewDashboard;
