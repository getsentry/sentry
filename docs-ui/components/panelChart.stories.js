import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import AreaChart from 'app/components/charts/areaChart';
import PanelChart from 'app/components/charts/panelChart';
import PieChart from 'app/components/charts/pieChart';

storiesOf('Charts|PanelChart', module).add(
  'PanelChart',
  withInfo('PanelChart')(() => {
    const TOTAL = 6;
    const NOW = new Date().getTime();
    const getValue = () => Math.round(Math.random() * 1000);
    const getDate = num => NOW - (TOTAL - num) * 86400000;
    const getData = num =>
      [...Array(num)].map((v, i) => ({value: getValue(), name: getDate(i)}));
    const browsers = {
      seriesName: '',
      data: [
        {
          name: 'Chrome',
          value: 3500,
        },
        {
          name: 'Firefox',
          value: 650,
        },
        {
          name: 'Safari',
          value: 250,
        },
      ],
    };

    const errorSeries = [
      {
        seriesName: 'Handled',
        data: getData(7),
      },
      {
        seriesName: 'Unhandled',
        data: getData(7),
      },
    ];
    const previousPeriodData = {
      seriesName: 'Previous',
      data: getData(7),
    };

    return (
      <React.Fragment>
        <PanelChart title="Pie Chart" name="Browsers" series={[browsers]}>
          {({...props}) => <PieChart {...props} />}
        </PanelChart>

        <PanelChart
          title="Area Chart"
          name="Browsers"
          series={errorSeries}
          previousPeriod={previousPeriodData}
        >
          {({...props}) => <AreaChart {...props} />}
        </PanelChart>
      </React.Fragment>
    );
  })
);
