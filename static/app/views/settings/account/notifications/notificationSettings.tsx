import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import {Organization} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';

type Props = {
  notificationType: string;
  organizations: Organization[];
} & AsyncComponent['props'];

type State = AsyncComponent['state'];

class NotificationSettings extends AsyncComponent<Props, State> {}

export default withOrganizations(NotificationSettings);
