import type {RouteComponentProps} from 'react-router';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';

import NotificationSettings from './notificationSettings';

interface NotificationSettingsControllerProps extends RouteComponentProps<{}, {}> {
  organizations: Organization[];
  organizationsLoading?: boolean;
}

export function NotificationSettingsController({
  organizationsLoading,
}: NotificationSettingsControllerProps) {
  if (organizationsLoading) {
    return <LoadingIndicator />;
  }
  return <NotificationSettings />;
}

export default withOrganizations(NotificationSettingsController);
