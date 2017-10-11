import React from 'react';

import OrganizationSettingsNavigation from './organizationSettingsNavigation';
import SettingsLayout from '../settingsLayout';

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
