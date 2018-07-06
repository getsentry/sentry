import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DiscoverChartJS from 'app/components/discoverChartJS';

storiesOf('Discover: Chart.JS', module).add(
  'default',
  withInfo('Sample chart using chart.js')(() => (
    <div style={{padding: 20, backgroundColor: '#ffffff'}}>
      <DiscoverChartJS title="Area Example" fill={'origin'}/>
      <DiscoverChartJS title="Line Example"/>
    </div>
  ))
);
