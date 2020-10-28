import Reflux from 'reflux';
import React from 'react';
import createReactClass from 'create-react-class';

import SentryTypes from 'app/sentryTypes';
import HookStore from 'app/stores/hookStore';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';
import navigationConfiguration from 'app/views/settings/organization/navigationConfiguration';
import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';
import {HookName, Hooks} from 'app/types/hooks';
import {NavigationSection} from 'app/views/settings/types';

type Props = {
  organization: Organization;
};

type State = {
  hookConfigs: NavigationSection[];
  hooks: React.ReactElement[];
};

const OrganizationSettingsNavigation = createReactClass<Props, State>({
  displayName: 'OrganizationSettingsNavigation',
  propTypes: {
    organization: SentryTypes.Organization,
  },

  /**
   * TODO(epurkhiser): Becase the settings organization navigation hooks
   * do not conform to a normal component style hook, and take a single
   * parameter 'organization', we cannot use the `Hook` component here,
   * and must resort to using the mixin style HookStore to retrieve hook data.
   *
   * We should update the hook interface for the two hooks used here
   */
  mixins: [Reflux.listenTo(HookStore, 'handleHooks') as any],

  getInitialState() {
    return this.getHooks();
  },

  componentDidMount() {
    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState(this.getHooks());
  },

  getHooks() {
    // Allow injection via getsentry et all
    const {organization} = this.props as Props;

    return {
      hookConfigs: HookStore.get('settings:organization-navigation-config').map(cb =>
        cb(organization)
      ),
      hooks: HookStore.get('settings:organization-navigation').map(cb =>
        cb(organization)
      ),
    };
  },

  handleHooks(name: HookName, hooks: Hooks['settings:organization-navigation-config'][]) {
    const org = this.props.organization;
    if (name !== 'settings:organization-navigation-config') {
      return;
    }
    this.setState({hookConfigs: hooks.map(cb => cb(org))});
  },

  render() {
    const {hooks, hookConfigs} = this.state as State;
    const {organization} = this.props as Props;
    const access = new Set(organization.access);
    const features = new Set(organization.features);

    return (
      <SettingsNavigation
        navigationObjects={navigationConfiguration}
        access={access}
        features={features}
        organization={organization}
        hooks={hooks}
        hookConfigs={hookConfigs}
      />
    );
  },
});

export default withOrganization(OrganizationSettingsNavigation);
