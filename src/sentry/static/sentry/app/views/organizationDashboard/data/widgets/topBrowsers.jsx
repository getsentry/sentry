import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';

import topBrowsersQuery from '../queries/topBrowsers';

const topBrowsers = {
  type: WIDGET_DISPLAY.TABLE,
  queries: {discover: [topBrowsersQuery]},

  title: 'Browsers',
};

export default topBrowsers;
