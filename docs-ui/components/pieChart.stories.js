import React from 'react';

import PieChart from 'app/components/charts/pieChart';

export default {
  title: 'DataVisualization/Charts/PieChart',
  component: PieChart,
};

export const _PieChart = () => (
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
);
