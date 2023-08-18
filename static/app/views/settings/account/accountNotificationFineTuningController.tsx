import {RouteComponentProps} from 'react-router';

import {Organization} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';

import AccountNotificationFineTuning from './accountNotificationFineTuning';
import AccountNotificationFineTuningV2 from './accountNotificationFineTuningV2';

type Props = RouteComponentProps<{fineTuneType: string}, {}> & {
  organizations: Organization[];
};

export function AccountNotificationFineTuningController({
  organizations,
  ...props
}: Props) {
  // check if feature is enabled for any organization
  const hasFeature = organizations.some(org =>
    org.features.includes('notification-settings-v2')
  );
  return hasFeature ? (
    <AccountNotificationFineTuningV2 {...props} />
  ) : (
    <AccountNotificationFineTuning {...props} />
  );
}

export default withOrganizations(AccountNotificationFineTuningController);
