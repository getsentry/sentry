import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {number, boolean} from '@storybook/addon-knobs';

import CircleIndicator from 'app/components/circleIndicator';

storiesOf('CircleIndicator', module).add(
  'default',
  withInfo('Description')(() => {
    let enabled = boolean('Enabled', true);
    return (
      <React.Fragment>
        <CircleIndicator
          style={{marginRight: 12}}
          size={number('Size', 14)}
          enabled={enabled}
        />
        <CircleIndicator size={number('Size', 14)} enabled={!enabled} />
      </React.Fragment>
    );
  })
);
