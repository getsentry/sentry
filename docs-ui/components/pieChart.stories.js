import React from 'react';
import {withInfo} from '@storybook/addon-info';

import PieChart from 'app/components/charts/pieChart';

export default {
  title: 'DataVisualization/Charts/PieChart',
};

export const _PieChart = withInfo('PieChart')(() => (
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
));

_PieChart.story = {
  name: 'PieChart',
};
