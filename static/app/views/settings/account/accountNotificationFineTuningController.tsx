import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {useParams} from 'sentry/utils/useParams';
import withOrganizations from 'sentry/utils/withOrganizations';
import {NotificationSettingsByType} from 'sentry/views/settings/account/notifications/notificationSettingsByType';
import {getNotificationTypeFromPathname} from 'sentry/views/settings/account/notifications/utils';

import AccountNotificationFineTuning from './accountNotificationFineTuning';

interface AccountNotificationFineTuningControllerProps
  extends RouteComponentProps<{fineTuneType: string}> {
  organizations: Organization[];
  organizationsLoading?: boolean;
}

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

function AccountNotificationFineTuningController({
  organizationsLoading,
  ...props
}: AccountNotificationFineTuningControllerProps) {
  const params = useParams<{fineTuneType: string}>();
  const {fineTuneType: pathnameType} = params;
  const fineTuneType = getNotificationTypeFromPathname(pathnameType);

  if (organizationsLoading) {
    return <LoadingIndicator />;
  }

  if (accountNotifications.includes(fineTuneType)) {
    return <NotificationSettingsByType notificationType={fineTuneType} />;
  }

  return <AccountNotificationFineTuning {...props} />;
}

export default withOrganizations(AccountNotificationFineTuningController);
