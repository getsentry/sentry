import {RouteComponentProps} from 'react-router';

import {Organization} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';

import NotificationSettings from './notificationSettings';
import NotificationSettingsV2 from './notificationSettingsV2';

type Props = RouteComponentProps<{fineTuneType: string}, {}> & {
  organizations: Organization[];
};

export function NotificationSettingsController({organizations, ...props}: Props) {
  // check if feature is enabled for any organization
  const hasFeature = organizations.some(org =>
    org.features.includes('notification-settings-v2')
  );
  return hasFeature ? (
    <NotificationSettingsV2 {...props} />
  ) : (
    <NotificationSettings {...props} />
  );
}

export default withOrganizations(NotificationSettingsController);
