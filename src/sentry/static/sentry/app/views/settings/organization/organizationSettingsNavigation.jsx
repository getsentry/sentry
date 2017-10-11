import React from 'react';

import HookStore from '../../../stores/hookStore';
import OrganizationState from '../../../mixins/organizationState';
import SettingsNavigation from '../components/settingsNavigation';
import navigationConfiguration from './navigationConfiguration';

const OrganizationSettingsNavigation = React.createClass({
  mixins: [OrganizationState],

  getInitialState() {
    // Allow injection via getsentry et all
    let org = this.getOrganization();
    let hooks = [];
    HookStore.get('organization:settings-sidebar').forEach(cb => {
      hooks.push(cb(org));
    });

    return {
      hooks,
    };
  },

  render() {
    let access = this.getAccess();
    let features = this.getFeatures();
    let org = this.getOrganization();

    return (
      <SettingsNavigation
        navigationObjects={navigationConfiguration}
        access={access}
        features={features}
        organization={org}
        hooks={this.state.hooks}
      />
    );
  },
});

export default OrganizationSettingsNavigation;
