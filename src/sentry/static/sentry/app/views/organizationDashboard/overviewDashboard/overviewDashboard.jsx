import React from 'react';

import Dashboard from 'app/views/organizationDashboard/dashboard';
import overviewDashboard from 'app/views/organizationDashboard/data/dashboards/overviewDashboard';

class OverviewDashboard extends React.Component {
  render() {
    return <Dashboard {...overviewDashboard} />;
  }
}
export default OverviewDashboard;
export {OverviewDashboard};
