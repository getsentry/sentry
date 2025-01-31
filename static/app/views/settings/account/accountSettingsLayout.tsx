import {Component, Fragment} from 'react';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import withApi from 'sentry/utils/withApi';
import withLatestContext from 'sentry/utils/withLatestContext';
import AccountSettingsNavigation from 'sentry/views/settings/account/accountSettingsNavigation';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

type Props = React.ComponentProps<typeof SettingsLayout> & {
  api: Client;
  organization: Organization;
};

class AccountSettingsLayout extends Component<Props> {
  componentDidUpdate(prevProps: Props) {
    const {api, organization} = this.props;
    if (prevProps.organization === organization) {
      return;
    }

    // if there is no org in context, SidebarDropdown uses an org from `withLatestContext`
    // (which queries the org index endpoint instead of org details)
    // and does not have `access` info
    if (organization && typeof organization.access === 'undefined') {
      fetchOrganizationDetails(api, organization.slug, {
        setActive: true,
        loadProjects: true,
      });
    }
  }

  render() {
    const {organization} = this.props;

    const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

    if (hasNavigationV2) {
      return (
        <Fragment>
          <AccountSettingsNavigation organization={organization} />
          <SettingsLayout {...this.props}>{this.props.children}</SettingsLayout>
        </Fragment>
      );
    }

    return (
      <SettingsLayout
        {...this.props}
        renderNavigation={() => <AccountSettingsNavigation organization={organization} />}
      >
        {this.props.children}
      </SettingsLayout>
    );
  }
}

export default withLatestContext(withApi(AccountSettingsLayout));
