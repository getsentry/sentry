import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import DiscoverEcharts from 'app/components/discoverEcharts';

storiesOf('Discover: Echarts', module).add(
  'default',
  withInfo('Sample chart using chart.js')(() => (
    <div style={{padding: 20, backgroundColor: '#ffffff'}}>
      <DiscoverEcharts />
    </div>
  ))
);
