import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import OrganizationSettingsNavigation from 'app/views/settings/organization/organizationSettingsNavigation';
import SettingsLayout from 'app/views/settings/components/settingsLayout';

type Props = RouteComponentProps<{orgId: string}, {}> & {
  children: React.ReactNode;
};

function OrganizationSettingsLayout(props: Props) {
  return (
    <SettingsLayout
      {...props}
      renderNavigation={() => <OrganizationSettingsNavigation {...props} />}
    >
      {props.children}
    </SettingsLayout>
  );
}

export default OrganizationSettingsLayout;
