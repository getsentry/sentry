import {Organization} from 'app/types';
import getConfiguration from 'app/views/settings/account/navigationConfiguration';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';

type Props = {
  organization: Organization;
};

const AccountSettingsNavigation = ({organization}: Props) => (
  <SettingsNavigation navigationObjects={getConfiguration({organization})} />
);

export default AccountSettingsNavigation;
