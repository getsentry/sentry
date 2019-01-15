import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';

import eventsByRelease from '../queries/eventsByRelease';

const eventsByReleasePercent = {
  type: WIDGET_DISPLAY.STACKED_AREA_CHART,
  queries: {discover: [eventsByRelease]},
  title: 'Events By Release',
};

export default eventsByReleasePercent;
