import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import withOrganizations from 'sentry/utils/withOrganizations';

import NotificationSettings from './notificationSettings';

interface NotificationSettingsControllerProps {
  organizations: Organization[];
  organizationsLoading?: boolean;
}

function NotificationSettingsController({
  organizationsLoading,
}: NotificationSettingsControllerProps) {
  if (organizationsLoading) {
    return <LoadingIndicator />;
  }
  return <NotificationSettings />;
}

export default withOrganizations(NotificationSettingsController);
