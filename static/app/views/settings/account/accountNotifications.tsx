import {OrganizationSummary} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';
import AsyncView from 'app/views/asyncView';
import NotificationSettings from 'app/views/settings/account/notifications/notificationSettings';

type Props = AsyncView['props'] & {
  organizations: OrganizationSummary[];
};

type State = AsyncView['state'] & {
  data: Record<string, unknown> | null;
};

class AccountNotifications extends AsyncView<Props, State> {
  renderBody() {
    return <NotificationSettings />;
  }
}

export default withOrganizations(AccountNotifications);
