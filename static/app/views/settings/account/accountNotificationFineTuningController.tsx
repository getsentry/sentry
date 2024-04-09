import type {RouteComponentProps} from 'react-router';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';

import AccountNotificationFineTuning from './accountNotificationFineTuning';

interface AccountNotificationFineTuningControllerProps
  extends RouteComponentProps<{fineTuneType: string}, {}> {
  organizations: Organization[];
  organizationsLoading?: boolean;
}

export function AccountNotificationFineTuningController({
  organizationsLoading,
  ...props
}: AccountNotificationFineTuningControllerProps) {
  if (organizationsLoading) {
    return <LoadingIndicator />;
  }

  return <AccountNotificationFineTuning {...props} />;
}

export default withOrganizations(AccountNotificationFineTuningController);
