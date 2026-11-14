import {useStore} from 'zustand';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';

import {NotificationSettings} from './notificationSettings';

function NotificationSettingsController() {
  const loaded = useStore(OrganizationsStore, state => state.loaded);
  if (!loaded) {
    return <LoadingIndicator />;
  }
  return <NotificationSettings />;
}

export default NotificationSettingsController;
