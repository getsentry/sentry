import React from 'react';
import createReactClass from 'create-react-class';

import OrganizationState from '../../mixins/organizationState';
import OldDashboard from './oldDashboard';
import ProjectNav from './projectNav';

class Dashboard extends React.Component {
  render() {
    return (
      <div>
        <ProjectNav />
        New dashboard placeholder
      </div>
    );
  }
}

const OrganizationDashboard = createReactClass({
  displayName: 'OrganizationDashboard',
  mixins: [OrganizationState],

  render() {
    const hasNewDashboardFeature = this.getFeatures().has('dashboard');

    if (hasNewDashboardFeature) {
      return <Dashboard {...this.props} />;
    } else {
      return <OldDashboard {...this.props} />;
    }
  },
});

export default OrganizationDashboard;
