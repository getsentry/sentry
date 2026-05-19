import {Component} from 'react';

import {ConfigStore} from 'sentry/stores/configStore';
import {HookStore} from 'sentry/stores/hookStore';
import type {HookName, Hooks} from 'sentry/types/hooks';
import type {Organization} from 'sentry/types/organization';
import {withOrganization} from 'sentry/utils/withOrganization';
import {SettingsNavigation} from 'sentry/views/settings/components/settingsNavigation';
import {getUserOrgNavigationConfiguration} from 'sentry/views/settings/organization/userOrgNavigationConfiguration';
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
      hook: Hooks['settings:organization-navigation-config'] | undefined
    ) => {
      this.handleHooks(hookName, hook);
    },
    undefined
  );

  getHooks() {
    // Allow injection via getsentry et all
    const {organization} = this.props as Props;

    const navConfig = HookStore.get('settings:organization-navigation-config');
    const navHook = HookStore.get('settings:organization-navigation');

    return {
      hookConfigs: navConfig ? [navConfig(organization)] : [],
      hooks: navHook ? [navHook(organization)] : [],
    };
  }

  handleHooks(
    name: HookName,
    hook: Hooks['settings:organization-navigation-config'] | undefined
  ) {
    const org = this.props.organization;
    if (name !== 'settings:organization-navigation-config') {
      return;
    }
    this.setState({hookConfigs: hook ? [hook(org)] : []});
  }

  render() {
    const {hooks, hookConfigs} = this.state;
    const {organization} = this.props as Props;
    const access = new Set(organization.access);
    const features = new Set(organization.features);
    const isSelfHosted = ConfigStore.get('isSelfHosted');

    return (
      <SettingsNavigation
        navigationObjects={getUserOrgNavigationConfiguration()}
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
