import {useSelector} from '@tanstack/react-store';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';

import {NotificationSettings} from './notificationSettings';

function NotificationSettingsController() {
  const loaded = useSelector(OrganizationsStore.store, state => state.loaded);
  if (!loaded) {
    return <LoadingIndicator />;
  }
  return <NotificationSettings />;
}

export default NotificationSettingsController;
