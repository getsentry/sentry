import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import HighchartsDiscover from 'app/components/highchartsDiscover';
import HighstockDiscover from 'app/components/highstockDiscover';
import HighchartsDiscoverWrapper from 'app/components/highchartsDiscoverWrapper';

storiesOf('Discover: High Charts', module).add(
  'default',
  withInfo('Sample chart using highcharts; using data from: {\n' +
      '    "aggregations": [\n' +
      '        [\n' +
      '            "count()",\n' +
      '            "",\n' +
      '            "aggregate"\n' +
      '        ]\n' +
      '    ],\n' +
      '    "conditions": [],\n' +
      '    "from_date": "2018-01-20T18:26:46",\n' +
      '    "granularity": 86400,\n' +
      '    "groupby": "time",\n' +
      '    "project": 1,\n' +
      '    "orderby": "time",\n' +
      '    "to_date": "2018-06-20T18:26:46"\n' +
      '}')(() => (
    <div style={{padding: 20, backgroundColor: '#ffffff'}}>
        <HighchartsDiscover />
        {/*<HighchartsDiscoverWrapper/>*/}
        <HighstockDiscover/>
    </div>
  ))
);
