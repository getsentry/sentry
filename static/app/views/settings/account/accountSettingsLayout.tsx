import {Component} from 'react';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organizations';
import {Client} from 'sentry/api';
import SentryTypes from 'sentry/sentryTypes';
import {Organization} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withLatestContext from 'sentry/utils/withLatestContext';
import AccountSettingsNavigation from 'sentry/views/settings/account/accountSettingsNavigation';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

type Props = React.ComponentProps<typeof SettingsLayout> & {
  api: Client;
  organization: Organization;
};

class AccountSettingsLayout extends Component<Props> {
  static childContextTypes = {
    organization: SentryTypes.Organization,
  };

  getChildContext() {
    return {
      organization: this.props.organization,
    };
  }

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
