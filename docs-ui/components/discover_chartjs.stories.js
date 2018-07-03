import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import HighchartsDiscover from 'app/components/highchartsDiscover';

storiesOf('Discover: Chart.JS', module).add(
  'default',
  withInfo('Sample chart using chart.js')(() => (
    <div style={{padding: 20, backgroundColor: '#ffffff'}}>
        <HighchartsDiscover />
        {/*<HighchartsDiscoverWrapper/>*/}
        <HighstockDiscover/>
    </div>
  ))
);
