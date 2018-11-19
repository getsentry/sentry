import React from 'react';

import {DEFAULT_STATS_PERIOD, DEFAULT_USE_UTC} from 'app/constants';

const EventsContext = React.createContext({
  project: [],
  environment: [],
  period: DEFAULT_STATS_PERIOD,
  start: null,
  end: null,
  utc: DEFAULT_USE_UTC,
});

export default EventsContext;
