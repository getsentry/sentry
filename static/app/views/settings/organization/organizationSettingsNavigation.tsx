import {Component} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import type {HookName, Hooks} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';
import navigationConfiguration from 'sentry/views/settings/organization/navigationConfiguration';
import type {NavigationSection} from 'sentry/views/settings/types';

type Props = {
  organization: Organization;
};

type State = {
  hookConfigs: NavigationSection[];
  hooks: React.ReactElement[];
};

class OrganizationSettingsNavigation extends Component<Props, State> {
  state: State = this.getHooks();

  componentDidMount() {
    this.setState(this.getHooks());
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  /**
   * TODO(epurkhiser): Becase the settings organization navigation hooks
   * do not conform to a normal component style hook, and take a single
   * parameter 'organization', we cannot use the `Hook` component here,
   * and must resort to using listening to the HookStore to retrieve hook data.
   *
   * We should update the hook interface for the two hooks used here
   */
  unsubscribe = HookStore.listen(
    (
      hookName: HookName,
      hooks: Array<Hooks['settings:organization-navigation-config']>
    ) => {
      this.handleHooks(hookName, hooks);
    },
    undefined
  );

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
  }

  handleHooks(
    name: HookName,
    hooks: Array<Hooks['settings:organization-navigation-config']>
  ) {
    const org = this.props.organization;
    if (name !== 'settings:organization-navigation-config') {
      return;
    }
    this.setState({hookConfigs: hooks.map(cb => cb(org))});
  }

  render() {
    const {hooks, hookConfigs} = this.state;
    const {organization} = this.props as Props;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const isSelfHosted = ConfigStore.get('isSelfHosted');
    return (
      <SettingsNavigation
        navigationObjects={navigationConfiguration}
        access={access}
        features={features}
        organization={organization}
        hooks={hooks}
        hookConfigs={hookConfigs}
        isSelfHosted={isSelfHosted}
      />
    );
  }
}

export default withOrganization(OrganizationSettingsNavigation);
