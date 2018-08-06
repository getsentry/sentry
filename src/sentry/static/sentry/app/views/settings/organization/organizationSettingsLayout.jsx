import React from 'react';

import OrganizationSettingsNavigation from 'app/views/settings/organization/organizationSettingsNavigation';
import SettingsLayout from 'app/views/settings/components/settingsLayout';

export default class OrganizationSettingsLayout extends React.Component {
  render() {
    return (
      <SettingsLayout
        {...this.props}
        renderNavigation={() => <OrganizationSettingsNavigation {...this.props} />}
      >
        {this.props.children}
      </SettingsLayout>
    );
  }
}
