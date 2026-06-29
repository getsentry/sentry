import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {NotificationSettings} from './notificationSettings';

function NotificationSettingsController() {
  const {loaded} = useLegacyStore(OrganizationsStore);
  if (!loaded) {
    return <LoadingIndicator />;
  }
  return <NotificationSettings />;
}

export default NotificationSettingsController;
