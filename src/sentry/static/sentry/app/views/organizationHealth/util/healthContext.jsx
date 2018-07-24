import React from 'react';

const HealthContext = React.createContext({
  projects: [],
  environments: [],
  daterange: '7d',
});

export default HealthContext;
