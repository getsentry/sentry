import * as React from 'react';
import {RouteComponentProps} from 'react-router';

import SettingsLayout from 'app/views/settings/components/settingsLayout';
import OrganizationSettingsNavigation from 'app/views/settings/organization/organizationSettingsNavigation';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  children: React.ReactNode;
};

function OrganizationSettingsLayout(props: Props) {
  return (
    <SettingsLayout
      {...props}
      renderNavigation={() => <OrganizationSettingsNavigation />}
    />
  );
}

export default OrganizationSettingsLayout;
