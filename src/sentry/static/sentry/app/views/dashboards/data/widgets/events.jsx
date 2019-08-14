import {WIDGET_DISPLAY} from 'app/views/dashboards/constants';

import eventsQuery from '../queries/events';

const events = {
  type: WIDGET_DISPLAY.LINE_CHART,
  queries: {
    discover: [eventsQuery],
  },
  title: 'Events',

  includePreviousPeriod: true,
  includeReleases: true,
  aggregateLabelMap: {
    count: 'Events',
  },
};

export default events;
