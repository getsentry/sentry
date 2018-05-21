import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Panel from 'app/components/panels/panel';
import PanelBody from 'app/components/panels/panelBody';
import PanelHeader from 'app/components/panels/panelHeader';

import BarChart from 'app/components/barChart';

let d = Date.now();

const SERIES = [
  {
    data: [
      {x: d - 9, y: 1},
      {x: d - 8, y: 2},
      {x: d - 7, y: 3},
      {x: d - 6, y: 4},
      {x: d - 5, y: 5},
      {x: d - 4, y: 6},
      {x: d - 3, y: 7},
      {x: d - 2, y: 8},
      {x: d - 1, y: 9},
      {x: d, y: 10},
    ],
    label: 'Bad Stuffs',
  },
];

const SERIES_WITH_COLOR = [
  {
    data: [
      {x: d - 9, y: 2},
      {x: d - 8, y: 4},
      {x: d - 7, y: 6},
      {x: d - 6, y: 8},
      {x: d - 5, y: 10},
      {x: d - 4, y: 12},
      {x: d - 3, y: 14},
      {x: d - 2, y: 16},
      {x: d - 1, y: 18},
      {x: d, y: 20},
    ],
    color: '#706779',
    shadowSize: 0,
    label: '4xx',
  },
  {
    data: [
      {x: d - 9, y: 4},
      {x: d - 8, y: 8},
      {x: d - 7, y: 12},
      {x: d - 6, y: 16},
      {x: d - 5, y: 20},
      {x: d - 4, y: 24},
      {x: d - 3, y: 28},
      {x: d - 2, y: 32},
      {x: d - 1, y: 36},
      {x: d, y: 40},
    ],
    color: '#9F92AD',
    label: '5xx',
  },
  {
    data: [
      {x: d - 9, y: 4},
      {x: d - 8, y: 8},
      {x: d - 7, y: 12},
      {x: d - 6, y: 16},
      {x: d - 5, y: 20},
      {x: d - 4, y: 24},
      {x: d - 3, y: 28},
      {x: d - 2, y: 32},
      {x: d - 1, y: 36},
      {x: d, y: 40},
    ],
    color: '#C9C0D3',
    label: '2xx',
  },
];

storiesOf('BarChart', module).add(
  'default',
  withInfo('BarCharts with various options')(() => (
    <div>
      <Panel>
        <PanelHeader>Default Barchart</PanelHeader>
        <PanelBody disablePadding={false}>
          <BarChart series={SERIES} height={50} />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader>Stacked BarChart</PanelHeader>
        <PanelBody disablePadding={false}>
          <BarChart series={SERIES_WITH_COLOR} height={50} />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader>Stacked BarChart with y-axis</PanelHeader>
        <PanelBody disablePadding={false}>
          <BarChart showAxis series={SERIES_WITH_COLOR} height={50} />
        </PanelBody>
      </Panel>
    </div>
  ))
);
