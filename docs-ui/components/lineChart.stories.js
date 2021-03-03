import React from 'react';

import LineChart from 'app/components/charts/lineChart';

export default {
  title: 'DataVisualization/Charts/LineChart',
  component: LineChart,
};

export const _LineChart = () => {
  return (
    <LineChart
      style={{height: 400}}
      series={[
        {
          seriesName: 'Chrome',
          data: [
            {
              value: 632,
              name: 'Jan 1',
            },
            {
              value: 107,
              name: 'Jan 2',
            },
            {
              value: 302,
              name: 'Jan 3',
            },
            {
              value: 3,
              name: 'Jan 4',
            },
          ],
        },
        {
          seriesName: 'Safari',
          data: [
            {
              value: 100,
              name: 'Jan 1',
            },
            {
              value: 403,
              name: 'Jan 2',
            },
            {
              value: 222,
              name: 'Jan 3',
            },
            {
              value: 482,
              name: 'Jan 4',
            },
          ],
        },
      ]}
    />
  );
};
