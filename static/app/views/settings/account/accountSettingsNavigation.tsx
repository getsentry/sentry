import type {Organization} from 'sentry/types/organization';
import getConfiguration from 'sentry/views/settings/account/navigationConfiguration';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';

type Props = {
  organization: Organization;
};

function AccountSettingsNavigation({organization}: Props) {
  return (
    <SettingsNavigation
      organization={organization}
      navigationObjects={getConfiguration({organization})}
    />
  );
}

export default AccountSettingsNavigation;
