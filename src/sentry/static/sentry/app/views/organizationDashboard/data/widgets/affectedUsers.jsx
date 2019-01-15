import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';

import anonymousUsersAffected from 'app/views/organizationDashboard/data/queries/anonymousUsersAffected';
import knownUsersAffected from 'app/views/organizationDashboard/data/queries/knownUsersAffected';

const affectedUsers = {
  type: WIDGET_DISPLAY.LINE_CHART,
  queries: {discover: [knownUsersAffected, anonymousUsersAffected]},

  title: 'Affected Users',
  yAxisMapping: [[0], [1]],
};

export default affectedUsers;
