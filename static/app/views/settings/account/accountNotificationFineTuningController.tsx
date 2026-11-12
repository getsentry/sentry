import {useStore} from 'zustand';

import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {NotificationSettingsByType} from './notifications/notificationSettingsByType';
import {getNotificationTypeFromPathname} from './notifications/utils';
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
  'inbox',
];

export default function AccountNotificationFineTuningController() {
  const {loaded} = useLegacyStore(OrganizationsStore);
  const organizationLoading = useStore(OrganizationStore, state => state.loading);
  const organization = useOrganization({allowNull: true});
  const {fineTuneType: pathnameType} = useParams<{fineTuneType: string}>();
  const fineTuneType = getNotificationTypeFromPathname(pathnameType);

  if (!loaded) {
    return <LoadingIndicator />;
  }

  if (fineTuneType === 'inbox') {
    // Account settings aren't wrapped in OrganizationContainer, so the org in
    // context can still be bootstrapping after OrganizationsStore has loaded.
    if (organizationLoading) {
      return <LoadingIndicator />;
    }
    if (!organization?.features.includes('universal-inbox')) {
      return <NotFound />;
    }
  }

  if (accountNotifications.includes(fineTuneType)) {
    return <NotificationSettingsByType notificationType={fineTuneType} />;
  }

  return <AccountNotificationFineTuning />;
}
