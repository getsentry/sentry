import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import BarChart from 'app/components/charts/barChart.jsx';

// eslint-disable-next-line
storiesOf('Charts/BarChart', module).add(
  'default',
  withInfo('Stacked Bar')(() => {
    return (
      <div>
        <h2 style={{paddingLeft: '60px'}}>Stacked Bar Charts:</h2>

        <BarChart
          style={{height: 250}}
          stacked={true}
          series={[
            {
              seriesName: 'Unhandled Errors',
              data: [
                {
                  value: 923,
                  category: 'Chrome',
                },
                {
                  value: 107,
                  category: 'Safari',
                },
                {
                  value: 50,
                  category: 'Firefox',
                },
              ],
            },
            {
              seriesName: 'Handled Errors',
              data: [
                {
                  value: 100,
                  category: 'Chrome',
                },
                {
                  value: 99,
                  category: 'Safari',
                },
                {
                  value: 66,
                  category: 'Opera',
                },
              ],
            },
          ]}
        />
        <BarChart
          style={{height: 400}}
          stacked={true}
          series={[
            {
              seriesName: 'Chrome',
              data: [
                {
                  value: 923,
                  category: 'Jan 1',
                },
                {
                  value: 107,
                  category: 'Jan 2',
                },
                {
                  value: 50,
                  category: 'Jan 3',
                },
              ],
            },
            {
              seriesName: 'Safari',
              data: [
                {
                  value: 100,
                  category: 'Jan 1',
                },
                {
                  value: 99,
                  category: 'Jan 2',
                },
                {
                  value: 66,
                  category: 'Jan 3',
                },
                {
                  value: 66,
                  category: 'Jan 4',
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
                  category: 'Jan 1',
                },
                {
                  value: 107,
                  category: 'Jan 2',
                },
                {
                  value: 50,
                  category: 'Jan 3',
                },
              ],
            },
            {
              seriesName: 'Safari',
              data: [
                {
                  value: 100,
                  category: 'Jan 1',
                },
                {
                  value: 99,
                  category: 'Jan 2',
                },
                {
                  value: 66,
                  category: 'Jan 3',
                },
                {
                  value: 66,
                  category: 'Jan 4',
                },
              ],
            },
          ]}
        />
      </div>
    );
  })
);
