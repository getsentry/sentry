import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';

import topDevicesQuery from '../queries/topDevices';

const topDevices = {
  type: WIDGET_DISPLAY.TABLE,
  queries: {discover: [topDevicesQuery]},

  title: 'Devices',
};

export default topDevices;
