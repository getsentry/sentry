import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import {number, boolean, text, array} from '@storybook/addon-knobs';

import LineChart from 'app/components/charts/lineChart';
import BarChart from 'app/components/charts/barChart';

storiesOf('Charts|Playground')
  .add(
    'Line Chart',
    withInfo('Description')(() => (
      <div style={{backgroundColor: 'white', padding: 12}}>
        <LineChart
          series={[
            {
              seriesName: text('Line 1', 'sentry:user'),
              data: [
                {value: 18, name: 'Aug 15th'},
                {value: 31, name: 'Aug 16th'},
                {value: 9, name: 'Aug 22nd'},
                {value: 100, name: 'Sep 5th'},
                {value: 12, name: 'Sep 6th'},
              ],
            },
            {
              seriesName: text('Line 2', 'environment'),
              data: [
                {value: 84, name: 'Aug 15th'},
                {value: 1, name: 'Aug 16th'},
                {value: 28, name: 'Aug 22nd'},
                {value: 1, name: 'Sep 5th'},
                {value: 1, name: 'Sep 6th'},
              ],
            },
            {
              seriesName: text('Line 3', 'browser'),
              data: [
                {value: 108, name: 'Aug 15th'},
                {value: 1, name: 'Aug 16th'},
                {value: 36, name: 'Aug 22nd'},
                {value: null, name: 'Se p 5th'},
                {value: 1, name: 'Sep 6th'},
              ],
            },
          ]}
          tooltip={{
            filter: value => value !== null,
            truncate: 80,
          }}
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
            top: text('GRID KNOBS:\ntop', 40),
            bottom: text('bottom', 20),
            left: text('left', '10%'),
            right: text('right', '10%'),
            containLabel: boolean('containLabel', true),
          }}
        />
      </div>
    ))
  )
  .add(
    'Bar Chart',
    withInfo('Description: Note Scroll Legends does not work in storybook')(() => (
      <div style={{backgroundColor: 'white', padding: 12}}>
        <BarChart
          stacked={boolean('stacked', true)}
          renderer="canvas"
          series={[
            {
              seriesName: text('Line 1', 'sentry:user'),
              data: [
                {value: 18, name: 'Aug 15th'},
                {value: 31, name: 'Aug 16th'},
                {value: 9, name: 'Aug 22nd'},
                {value: 100, name: 'Sep 5th'},
                {value: 12, name: 'Sep 6th'},
              ],
            },
            {
              seriesName: text('Line 2', 'environment'),
              data: [
                {value: 84, name: 'Aug 15th'},
                {value: 1, name: 'Aug 16th'},
                {value: 28, name: 'Aug 22nd'},
                {value: 1, name: 'Sep 5th'},
                {value: 1, name: 'Sep 6th'},
              ],
            },
            {
              seriesName: text('Line 3', 'browser'),
              data: [
                {value: 108, name: 'Aug 15th'},
                {value: 1, name: 'Aug 16th'},
                {value: 36, name: 'Aug 22nd'},
                {value: null, name: 'Se p 5th'},
                {value: 1, name: 'Sep 6th'},
              ],
            },
          ]}
          tooltip={{
            filter: value => value !== null,
            truncate: 50,
          }}
          legend={{
            show: boolean('show legend', true),
            data: [
              text('Line 1 Legend (match Line 1)', 'sentry:user'),
              text('Line 2 Legend (match Line 2)', 'environment'),
              text('Line 3 Legend (match Line 3)', 'browser'),
            ],
            padding: number('Legend Padding', 0),
            type: text('Legend Type', 'scroll'),
            orient: text('Legend Orient (vertical or horizontal)', 'horizontal'),

            align: text('Legend Align (left, right)', 'auto'),
            left: text('Legend Left (left, right, center)', 'center'),
            right: text('Legend Right (20 or 20%)', 'auto'),
            top: text('Legend top (top, middle, bottom)', 'auto'),
            bottom: text('Legend Bottom (20 or 20%)', 'auto'),
            width: text('Legend Width (string or number)', 'auto'),
            height: text('Legend Height', 'auto'),

          }}
          height={number('height', 300)}
          grid={{
            top: text('GRID KNOBS:\ntop', 40),
            bottom: text('bottom', 20),
            left: text('left', '10%'),
            right: text('right', '10%'),
            containLabel: boolean('containLabel', true),
          }}
        />
      </div>
    ))
  );
