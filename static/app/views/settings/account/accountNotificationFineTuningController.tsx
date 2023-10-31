import type {RouteComponentProps} from 'react-router';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';

import AccountNotificationFineTuning from './accountNotificationFineTuning';
import AccountNotificationFineTuningV2 from './accountNotificationFineTuningV2';

interface AccountNotificationFineTuningControllerProps
  extends RouteComponentProps<{fineTuneType: string}, {}> {
  organizations: Organization[];
  organizationsLoading?: boolean;
}

export function AccountNotificationFineTuningController({
  organizations,
  organizationsLoading,
  ...props
}: AccountNotificationFineTuningControllerProps) {
  if (organizationsLoading) {
    return <LoadingIndicator />;
  }

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
