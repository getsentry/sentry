import React from 'react';

const EventsContext = React.createContext({
  projects: [],
  environments: [],
  daterange: '7d',
});

export default EventsContext;
