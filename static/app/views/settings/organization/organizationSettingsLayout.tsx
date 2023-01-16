import {RouteComponentProps} from 'react-router';

import SettingsLayout from 'sentry/views/settings/components/settingsLayout';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';

type Props = RouteComponentProps<{}, {}> & {
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
