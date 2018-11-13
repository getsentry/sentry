import React from 'react';

const EventsContext = React.createContext({
  project: [],
  environment: [],
  period: '7d',
  start: null,
  end: null,
});

export default EventsContext;
