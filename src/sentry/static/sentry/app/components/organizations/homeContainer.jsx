import React from 'react';
import createReactClass from 'create-react-class';

import OrganizationState from 'app/mixins/organizationState';
import ProjectNav from 'app/views/organizationDashboard/projectNav';

const HomeContainer = createReactClass({
  displayName: 'HomeContainer',

  mixins: [OrganizationState],

  render() {
    return (
      <div className={`${this.props.className || ''} organization-home`}>
        <ProjectNav />
        <div className="container">{this.props.children}</div>
      </div>
    );
  },
});

export default HomeContainer;
