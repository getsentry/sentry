import {Fragment} from 'react';

import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';

type Props = RouteComponentProps & {
  children: React.ReactNode;
};

function OrganizationSettingsLayout(props: Props) {
  const organization = useOrganization();

  const hasNavigationV2 = organization?.features.includes('navigation-sidebar-v2');

  if (hasNavigationV2) {
    return (
      <Fragment>
        <OrganizationSettingsNavigation />
        <SettingsLayout {...props} />
      </Fragment>
    );
  }

  return (
    <SettingsLayout
      {...props}
      renderNavigation={() => <OrganizationSettingsNavigation />}
    />
  );
}

export default OrganizationSettingsLayout;
