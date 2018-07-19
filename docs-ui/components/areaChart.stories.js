import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import AreaChart from 'app/components/charts/areaChart';

// eslint-disable-next-line
storiesOf('Charts/AreaChart', module).add(
  'default',
  withInfo('Stacked AreaChart with previous period')(() => (
    <AreaChart
      startDate={new Date()}
      series={[
        {
          name: 'Handled',
          data: [150, 300, 250, 600, 342, 800, 750],
        },
        {
          name: 'Unhandled',
          data: [50, 200, 150, 300, 102, 283, 341],
        },
      ]}
      lines={[
        {
          name: 'Previous',
          data: [650, 300, 350, 300, 400, 250, 200],
        },
      ]}
    />
  ))
);
