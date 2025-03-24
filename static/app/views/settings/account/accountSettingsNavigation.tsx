import {prefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import type {Organization} from 'sentry/types/organization';
import getConfiguration from 'sentry/views/settings/account/navigationConfiguration';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';

type Props = {
  organization?: Organization;
};

function AccountSettingsNavigation({organization}: Props) {
  if (organization && prefersStackedNav()) {
    return <OrganizationSettingsNavigation organization={organization} />;
  }

  return (
    <SettingsNavigation
      organization={organization}
      navigationObjects={getConfiguration({organization})}
      features={new Set(organization?.features)}
      access={new Set(organization?.access)}
    />
  );
}

export default AccountSettingsNavigation;
