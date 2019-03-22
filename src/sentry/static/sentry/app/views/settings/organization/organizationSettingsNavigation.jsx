import Reflux from 'reflux';
import React from 'react';

import createReactClass from 'create-react-class';

import HookStore from 'app/stores/hookStore';
import OrganizationState from 'app/mixins/organizationState';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';
import navigationConfiguration from 'app/views/settings/organization/navigationConfiguration';

const OrganizationSettingsNavigation = createReactClass({
  displayName: 'OrganizationSettingsNavigation',
  mixins: [OrganizationState, Reflux.listenTo(HookStore, 'handleHooks')],

  getInitialState() {
    return this.getHooks();
  },

  componentDidMount() {
    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState(this.getHooks());
  },

  getHooks() {
    // Allow injection via getsentry et all
    const org = this.getOrganization();

    return {
      hookConfigs: HookStore.get('settings:organization-navigation-config').map(cb =>
        cb(org)
      ),
      hooks: HookStore.get('settings:organization-navigation').map(cb => cb(org)),
    };
  },

  handleHooks(name, hooks) {
    const org = this.getOrganization();
    if (name !== 'settings:organization-navigation-config') {
      return;
    }
    this.setState(state => ({
      hookConfigs: hooks.map(cb => cb(org)),
    }));
  },

  render() {
    const access = this.getAccess();
    const features = this.getFeatures();
    const org = this.getOrganization();
    const {hooks, hookConfigs} = this.state;

    return (
      <SettingsNavigation
        navigationObjects={navigationConfiguration}
        access={access}
        features={features}
        organization={org}
        hooks={hooks}
        hookConfigs={hookConfigs}
      />
    );
  },
});

export default OrganizationSettingsNavigation;
