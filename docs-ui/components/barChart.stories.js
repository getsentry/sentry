import React from 'react';
import {withInfo} from '@storybook/addon-info';

import BarChart from 'app/components/charts/barChart';

export default {
  title: 'DataVisualization/Charts/BarChart',
};

export const _BarChart = withInfo('Stacked & Unstacked Bar Charts')(() => {
  return (
    <div>
      <BarChart
        style={{height: 250}}
        stacked
        series={[
          {
            seriesName: 'Unhandled Errors',
            data: [
              {
                value: 923,
                name: 'Chrome',
              },
              {
                value: 107,
                name: 'Safari',
              },
              {
                value: 50,
                name: 'Firefox',
              },
            ],
          },
          {
            seriesName: 'Handled Errors',
            data: [
              {
                value: 100,
                name: 'Chrome',
              },
              {
                value: 99,
                name: 'Safari',
              },
              {
                value: 66,
                name: 'Opera',
              },
            ],
          },
        ]}
      />
      <BarChart
        style={{height: 400}}
        stacked
        series={[
          {
            seriesName: 'Chrome',
            data: [
              {
                value: 923,
                name: 'Jan 1',
              },
              {
                value: 107,
                name: 'Jan 2',
              },
              {
                value: 50,
                name: 'Jan 3',
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
                value: 99,
                name: 'Jan 2',
              },
              {
                value: 66,
                name: 'Jan 3',
              },
              {
                value: 66,
                name: 'Jan 4',
              },
            ],
          },
        ]}
      />
      <h2 style={{paddingLeft: '60px'}}>Regular Bar Chart (Not Stacked):</h2>
      <BarChart
        style={{height: 400}}
        series={[
          {
            seriesName: 'Chrome',
            data: [
              {
                value: 923,
                name: 'Jan 1',
              },
              {
                value: 107,
                name: 'Jan 2',
              },
              {
                value: 50,
                name: 'Jan 3',
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
                value: 99,
                name: 'Jan 2',
              },
              {
                value: 66,
                name: 'Jan 3',
              },
              {
                value: 66,
                name: 'Jan 4',
              },
            ],
          },
        ]}
      />
    </div>
  );
});

_BarChart.story = {
  name: 'BarChart',
};
