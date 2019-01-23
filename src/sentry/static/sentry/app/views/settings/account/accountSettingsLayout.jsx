import React from 'react';

import AccountSettingsNavigation from 'app/views/settings/account/accountSettingsNavigation';
import {fetchOrganizationDetails} from 'app/actionCreators/organizations';
import SentryTypes from 'app/sentryTypes';
import SettingsLayout from 'app/views/settings/components/settingsLayout';
import withLatestContext from 'app/utils/withLatestContext';

class AccountSettingsLayout extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  componentDidUpdate(prevProps) {
    let {organization} = this.props;
    if (prevProps.organization === organization) return;

    // if there is no org in context, SidebarDropdown uses an org from `withLatestContext`
    // (which queries the org index endpoint instead of org details)
    // and does not have `access` info
    if (organization && typeof organization.access === 'undefined') {
      fetchOrganizationDetails(organization.slug, {
        setActive: true,
        loadProjects: true,
      });
    }
  }

  render() {
    return (
      <div className="app">
        <SettingsLayout
          {...this.props}
          renderNavigation={() => <AccountSettingsNavigation {...this.props} />}
        >
          {this.props.children}
        </SettingsLayout>
      </div>
    );
  }
}

export default withLatestContext(AccountSettingsLayout);
