import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {text} from '@storybook/addon-knobs';

import Hovercard from 'app/components/hovercard';

storiesOf('Hovercard', module).add(
  'default',
  withInfo(
    'Good luck if your container element is near the top and/or left side of the screen'
  )(() => (
    <div
      style={{
        height: 300,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Hovercard
        header={text('Header', 'Hovercard Header')}
        body={text('Body', 'Hovercard body (can also be a React node)')}
      >
        Hover over me
      </Hovercard>
    </div>
  ))
);
