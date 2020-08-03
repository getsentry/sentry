import React from 'react';
import {action} from '@storybook/addon-actions';
import {withInfo} from '@storybook/addon-info';
import {number, boolean, text} from '@storybook/addon-knobs';

import ChartZoom from 'app/components/charts/chartZoom';
import LineChart from 'app/components/charts/lineChart';

export default {
  title: 'Charts/Utilities',
};

export const _ChartZoom = withInfo(`This is a strongly opinionated component that takes a render prop through "children".
  It requires the Global Selection Header and will update the date range selector when zooming. It also
  has specific behavior to control when the component should update, as well as opinions for
  the time interval to use.
    `)(() => (
  <div style={{backgroundColor: 'white', padding: 12}}>
    <ChartZoom onZoom={action('ChartZoom.onZoom')}>
      {zoomRenderProps => (
        <LineChart
          tooltip={{
            filter: value => value !== null,
            truncate: 80,
          }}
          {...zoomRenderProps}
          legend={{
            data: [
              text('Line 1 Legend (match Line 1)', 'sentry:user'),
              text('Line 2 Legend (match Line 2)', 'environment'),
              text('Line 3 Legend (match Line 3)', 'browser'),
            ],
            type: text('Legend Type', 'scroll'),
          }}
          height={number('height', 300)}
          grid={{
            top: text('grid:top', 40),
            bottom: text('grid:bottom', 20),
            left: text('grid:left', '10%'),
            right: text('grid:right', '10%'),
            containLabel: boolean('grid:containLabel', true),
          }}
          series={[
            {
              seriesName: text('Line 1', 'sentry:user'),
              data: [
                {value: 18, name: 1531094400000},
                {value: 31, name: 1531180800000},
                {value: 9, name: 1532070000000},
                {value: 100, name: 1532156400000},
                {value: 12, name: 1532242800000},
              ],
            },
            {
              seriesName: text('Line 2', 'environment'),
              data: [
                {value: 84, name: 1531094400000},
                {value: 1, name: 1531180800000},
                {value: 28, name: 1532070000000},
                {value: 1, name: 1532156400000},
                {value: 1, name: 1532242800000},
              ],
            },
            {
              seriesName: text('Line 3', 'browser'),
              data: [
                {value: 108, name: 1531094400000},
                {value: 1, name: 1531180800000},
                {value: 36, name: 1532070000000},
                {value: 0, name: 1532156400000},
                {value: 1, name: 1532242800000},
              ],
            },
          ]}
        />
      )}
    </ChartZoom>
  </div>
));
