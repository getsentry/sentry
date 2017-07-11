import React from 'react';
import {storiesOf} from '@storybook/react';

import {NavHeader, NavStacked, NavItem} from 'sentry-ui/navigation';

storiesOf('Navigation').addWithInfo('default', 'Sidebar-based navigation', () => (
  <div>
    <NavHeader>Organization</NavHeader>
    <NavStacked>
      <NavItem to="/styleguide/">Dashboard</NavItem>
      <NavItem to="/org/projects-and-teams">Projects & Teams</NavItem>
      <NavItem to="/org/stats">Stats</NavItem>
    </NavStacked>
  </div>
));
