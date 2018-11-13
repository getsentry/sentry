import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import NavTabs from 'app/components/navTabs';

storiesOf('UI|NavTabs', module)
  .add(
    'default',
    withInfo('NavTabs')(() => {
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
    })
  )
  .add(
    'underlined',
    withInfo('NavTabs with bottom border applied')(() => {
      return (
        <NavTabs underlined={true}>
          <li className="active">
            <a href="#">link one</a>
          </li>
          <li>
            <a href="#">link two</a>
          </li>
        </NavTabs>
      );
    })
  );
