import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import withOrganizations from 'sentry/utils/withOrganizations';

import AccountNotificationFineTuning from './accountNotificationFineTuning';

interface AccountNotificationFineTuningControllerProps
  extends RouteComponentProps<{fineTuneType: string}> {
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
