import {WIDGET_DISPLAY} from 'app/views/dashboards/constants';

import eventsByRelease from '../queries/eventsByRelease';

const eventsByReleasePercent = {
  type: WIDGET_DISPLAY.PERCENTAGE_AREA_CHART,
  queries: {discover: [eventsByRelease]},
  title: 'Events By Release',
};

export default eventsByReleasePercent;
