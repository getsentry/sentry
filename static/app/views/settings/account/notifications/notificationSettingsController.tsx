import type {RouteComponentProps} from 'react-router';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';

import NotificationSettings from './notificationSettings';
import NotificationSettingsV2 from './notificationSettingsV2';

interface NotificationSettingsControllerProps extends RouteComponentProps<{}, {}> {
  organizations: Organization[];
  organizationsLoading?: boolean;
}

export function NotificationSettingsController({
  organizations,
  organizationsLoading,
  ...props
}: NotificationSettingsControllerProps) {
  if (organizationsLoading) {
    return <LoadingIndicator />;
  }

  // check if feature is enabled for any organization
  const hasFeature = organizations.some(org =>
    org.features.includes('notification-settings-v2')
  );
  return hasFeature ? <NotificationSettingsV2 /> : <NotificationSettings {...props} />;
}

export default withOrganizations(NotificationSettingsController);
