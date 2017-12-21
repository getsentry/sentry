import Reflux from 'reflux';
import React from 'react';

import HookStore from '../../../stores/hookStore';
import OrganizationState from '../../../mixins/organizationState';
import SettingsNavigation from '../components/settingsNavigation';
import navigationConfiguration from './navigationConfiguration';

const OrganizationSettingsNavigation = React.createClass({
  mixins: [OrganizationState, Reflux.listenTo(HookStore, 'handleHooks')],

  handleHooks(name, hooks) {
    let org = this.getOrganization();
    if (name !== 'settings:organization-navigation-config') return;
    this.setState(state => ({
      hookConfigs: [...state.hookConfigs, ...hooks.map(cb => cb(org))],
    }));
  },

  getInitialState() {
    // Allow injection via getsentry et all
    let org = this.getOrganization();

    return {
      hookConfigs: HookStore.get('settings:organization-navigation-config').map(cb =>
        cb(org)
      ),
      hooks: HookStore.get('settings:organization-navigation').map(cb => cb(org)),
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
        hookConfigs={this.state.hookConfigs}
      />
    );
  },
});

export default OrganizationSettingsNavigation;
