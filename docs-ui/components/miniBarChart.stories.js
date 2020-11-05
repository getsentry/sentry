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
    <React.Fragment>
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
              color: theme.pink300,
            },
            {
              name: 'Last Seen',
              value: (startTime + interval * 23) * 1000,
              color: theme.green300,
            },
          ]}
        />
      </div>

      <div className="section">
        <h3>No markers and emphasis colors</h3>
        <MiniBarChart
          width={160}
          height={24}
          isGroupedByDate
          showTimeInTooltip
          emphasisColors={[theme.purple400]}
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

      <div className="section">
        <h3>With yAxis labels and stacked results</h3>
        <MiniBarChart
          height={150}
          labelYAxisExtents
          isGroupedByDate
          showTimeInTooltip
          stacked
          series={[
            {
              seriesName: 'Accepted',
              data: all.map((value, i) => ({
                name: (startTime + interval * i) * 1000,
                value,
              })),
            },
            {
              seriesName: 'Rejected',
              data: current.map((value, i) => ({
                name: (startTime + interval * i) * 1000,
                value,
              })),
            },
          ]}
        />
      </div>
    </React.Fragment>
  );
});

_MiniBarChart.story = {
  name: 'MiniBarChart',
};
