import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import BarChart from 'app/components/charts/barChart';

storiesOf('Charts|BarChart', module).add(
  'BarChart',
  withInfo('Stacked & Unstacked Bar Charts')(() => {
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
          stacked={true}
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
  })
);
