import React from 'react';
import PropTypes from 'prop-types';

import AccountSettingsNavigation from 'app/views/settings/account/accountSettingsNavigation';
import ConfigStore from 'app/stores/configStore';
import {fetchOrganizationDetails} from 'app/actionCreators/organizations';
import SentryTypes from 'app/sentryTypes';
import SettingsLayout from 'app/views/settings/components/settingsLayout';
import withOrganizations from 'app/utils/withOrganizations';

class AccountSettingsLayout extends React.Component {
  static propTypes = {
    organizations: PropTypes.arrayOf(SentryTypes.Organization),
  };

  componentWillMount() {
    let lastOrg = ConfigStore.get('lastOrganization');
    if (lastOrg) {
      // load SidebarDropdown with org details including `access`
      fetchOrganizationDetails(lastOrg, {setActive: true, loadProjects: true});
    }
  }

  componentDidUpdate() {
    let lastOrg = ConfigStore.get('lastOrganization');
    if (lastOrg) return;

    // if there's no lastOrganization in session, wait for orgs to load
    // in OrganizationsStore and then fetch details for SidebarDropdown
    let {organizations} = this.props;
    if (organizations.length) {
      fetchOrganizationDetails(organizations[0].name, {
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

export default withOrganizations(AccountSettingsLayout);
