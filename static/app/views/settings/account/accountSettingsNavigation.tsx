import {Organization} from 'sentry/types';
import getConfiguration from 'sentry/views/settings/account/navigationConfiguration';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';

type Props = {
  organization: Organization;
};

const AccountSettingsNavigation = ({organization}: Props) => (
  <SettingsNavigation navigationObjects={getConfiguration({organization})} />
);

export default AccountSettingsNavigation;
