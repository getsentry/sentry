import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import PieChart from 'app/components/charts/pieChart';

storiesOf('Charts|PieChart', module).add(
  'PieChart',
  withInfo('PieChart')(() => (
    <PieChart
      startDate={new Date()}
      series={[
        {
          seriesName: 'Browsers',
          data: [
            {
              name: 'Chrome',
              value: 3500,
            },
            {
              name: 'Firefox',
              value: 650,
            },
            {
              name: 'Safari',
              value: 250,
            },
          ],
        },
      ]}
    />
  ))
);
