import React from 'react';

import Breadcrumbs from 'app/components/breadcrumbs';

export default {
  title: 'Core/Breadcrumbs',
  component: Breadcrumbs,
};

export const _Breadcrumbs = () => (
  <Breadcrumbs
    crumbs={[
      {label: 'Test 1', to: '#'},
      {label: 'Test 2', to: '#'},
      {label: 'Test 3', to: '#'},
      {label: 'Test 4', to: null},
    ]}
  />
);
