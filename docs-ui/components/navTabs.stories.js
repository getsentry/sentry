import {withInfo} from '@storybook/addon-info';

import NavTabs from 'app/components/navTabs';

export default {
  title: 'Core/NavTabs',
};

export const Default = withInfo('NavTabs')(() => {
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
});

Default.story = {
  name: 'default',
};

export const Underlined = withInfo('NavTabs with bottom border applied')(() => {
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
});

Underlined.story = {
  name: 'underlined',
};
