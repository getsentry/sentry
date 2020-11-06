import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {number, boolean} from '@storybook/addon-knobs';

import CircleIndicator from 'app/components/circleIndicator';

export default {
  title: 'DataVisualization/CircleIndicator',
};

export const Default = withInfo('Description')(() => {
  const enabled = boolean('Enabled', true);
  return (
    <React.Fragment>
      <CircleIndicator
        style={{marginRight: 12}}
        size={number('Size', 14)}
        enabled={enabled}
      />

      <CircleIndicator
        style={{marginRight: 12}}
        size={number('Size', 14)}
        enabled={!enabled}
      />

      <CircleIndicator size={number('Size', 14)} enabled={enabled} color="purple300" />
    </React.Fragment>
  );
});

Default.story = {
  name: 'default',
};
