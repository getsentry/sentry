import React from 'react';

import NavTabs from 'app/components/navTabs';

export default {
  title: 'Core/NavTabs',
  component: NavTabs,
};

export const Default = () => {
  return (
    <NavTabs>
      <li className="active">
        <a href="#">link one</a>
      </li>
      <li>
        <a href="#">link two</a>
      </li>
    </NavTabs>
  );
};

Default.storyName = 'default';

export const Underlined = () => {
  return (
    <NavTabs underlined>
      <li className="active">
        <a href="#">link one</a>
      </li>
      <li>
        <a href="#">link two</a>
      </li>
    </NavTabs>
  );
};

Underlined.storyName = 'underlined';
Underlined.parameters = {
  docs: {
    description: {
      story: 'NavTabs with bottom border applied',
    },
  },
};
