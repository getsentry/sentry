import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {useParams} from 'sentry/utils/useParams';
import {NotificationSettingsByType} from 'sentry/views/settings/account/notifications/notificationSettingsByType';
import {getNotificationTypeFromPathname} from 'sentry/views/settings/account/notifications/utils';

import {AccountNotificationFineTuning} from './accountNotificationFineTuning';

const accountNotifications = [
  'alerts',
  'deploy',
  'workflow',
  'approval',
  'quota',
  'spikeProtection',
  'reports',
  'brokenMonitors',
];

export default function AccountNotificationFineTuningController() {
  const {loaded} = useLegacyStore(OrganizationsStore);
  const {fineTuneType: pathnameType} = useParams<{fineTuneType: string}>();
  const fineTuneType = getNotificationTypeFromPathname(pathnameType);

  if (!loaded) {
    return <LoadingIndicator />;
  }

  if (accountNotifications.includes(fineTuneType)) {
    return <NotificationSettingsByType notificationType={fineTuneType} />;
  }

  return <AccountNotificationFineTuning />;
}
