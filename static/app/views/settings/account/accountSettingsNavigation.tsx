import {Organization} from 'sentry/types';
import getConfiguration from 'sentry/views/settings/account/navigationConfiguration';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';

type Props = {
  organization: Organization;
};

function AccountSettingsNavigation({organization}: Props) {
  return <SettingsNavigation navigationObjects={getConfiguration({organization})} />;
}

export default AccountSettingsNavigation;
