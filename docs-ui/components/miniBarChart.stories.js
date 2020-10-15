import React from 'react';
import {withInfo} from '@storybook/addon-info';

import theme from 'app/utils/theme';
import MiniBarChart from 'app/components/charts/miniBarChart';

export default {
  title: 'DataVisualization/Charts/MiniBarChart',
};

export const _MiniBarChart = withInfo('Stacked MiniBarChart')(() => {
  const startTime = 1601992800;
  const interval = 3600;
  const all = [
    0,
    1,
    2,
    4,
    9,
    6,
    17,
    6,
    25,
    8,
    23,
    28,
    19,
    17,
    17,
    29,
    11,
    20,
    15,
    12,
    19,
    13,
    1,
    4,
    0,
  ];
  const current = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    5,
    4,
    0,
    2,
    0,
  ];

  return (
    <div className="section">
      <h2>Stacked MiniBarChart</h2>

      <h3>With markers as per issue details</h3>
      <MiniBarChart
        width={294}
        height={70}
        isGroupedByDate
        showTimeInTooltip
        series={[
          {
            seriesName: 'All environments',
            data: all.map((value, i) => ({
              name: (startTime + interval * i) * 1000,
              value,
            })),
          },
          {
            seriesName: 'Release abc123',
            data: current.map((value, i) => ({
              name: (startTime + interval * i) * 1000,
              value,
            })),
          },
        ]}
        markers={[
          {
            barGap: '-100%',
            name: 'First Seen',
            value: (startTime + interval) * 1000,
            color: theme.pink400,
          },
          {
            name: 'Last Seen',
            value: (startTime + interval * 23) * 1000,
            color: theme.green400,
          },
        ]}
      />

      <h3>No markers as per issue list</h3>
      <MiniBarChart
        width={160}
        height={24}
        isGroupedByDate
        showTimeInTooltip
        series={[
          {
            seriesName: 'Events',
            data: all.map((value, i) => ({
              name: (startTime + interval * i) * 1000,
              value,
            })),
          },
        ]}
      />
    </div>
  );
});

_MiniBarChart.story = {
  name: 'MiniBarChart',
};
