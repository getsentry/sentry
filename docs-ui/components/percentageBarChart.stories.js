import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import PercentageBarChart from 'app/components/charts/percentageBarChart';

const TOTAL = 6;

// eslint-disable-next-line
storiesOf('Charts/PercentageBarChart', module).add(
  'default',
  withInfo('Stacked PercentageBar')(() => {
    const NOW = new Date().getTime();
    const getValue = () => Math.round(Math.random() * 1000);
    const getDate = num => NOW - (TOTAL - num) * 86400000;

    return (
      <div style={{padding: 20, backgroundColor: 'white'}}>
        <h2>Percentage Bar Charts Over Time</h2>

        <PercentageBarChart
          style={{height: 400}}
          series={[
            {
              seriesName: 'v2.0.0',
              data: [
                {
                  value: getValue(),
                  category: getDate(0),
                },
                {
                  value: 0,
                  category: getDate(1),
                },
                {
                  value: getValue(),
                  category: getDate(2),
                },
                {
                  value: getValue(),
                  category: getDate(3),
                },
                {
                  value: getValue(),
                  category: getDate(4),
                },
                {
                  value: getValue(),
                  category: getDate(5),
                },
                {
                  value: getValue(),
                  category: getDate(6),
                },
              ],
            },
            {
              seriesName: 'v2.1.0',
              data: [
                {
                  value: getValue(),
                  category: getDate(0),
                },
                {
                  value: 0,
                  category: getDate(1),
                },
                {
                  value: getValue(),
                  category: getDate(2),
                },
                {
                  value: getValue(),
                  category: getDate(3),
                },
                {
                  value: getValue(),
                  category: getDate(4),
                },
                {
                  value: getValue(),
                  category: getDate(5),
                },
                {
                  value: getValue(),
                  category: getDate(6),
                },
              ],
            },
            {
              seriesName: 'v2.1.1',
              data: [
                {
                  value: getValue(),
                  category: getDate(0),
                },
                {
                  value: 0,
                  category: getDate(1),
                },
                {
                  value: getValue(),
                  category: getDate(2),
                },
                {
                  value: getValue(),
                  category: getDate(3),
                },
                {
                  value: getValue(),
                  category: getDate(4),
                },
                {
                  value: getValue(),
                  category: getDate(5),
                },
                {
                  value: getValue(),
                  category: getDate(6),
                },
              ],
            },
            {
              seriesName: 'v3.0.0',
              data: [
                {
                  value: getValue(),
                  category: getDate(0),
                },
                {
                  value: 0,
                  category: getDate(1),
                },
                {
                  value: getValue(),
                  category: getDate(2),
                },
                {
                  value: getValue(),
                  category: getDate(3),
                },
                {
                  value: getValue(),
                  category: getDate(4),
                },
                {
                  value: getValue(),
                  category: getDate(5),
                },
                {
                  value: getValue(),
                  category: getDate(6),
                },
              ],
            },
          ]}
        />
      </div>
    );
  })
);
