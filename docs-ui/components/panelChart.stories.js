import React from 'react';

import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import AreaChart from 'app/components/charts/areaChart';
import PanelChart from 'app/components/charts/panelChart';
import PieChart from 'app/components/charts/pieChart';

// eslint-disable-next-line
storiesOf('Charts/PanelChart', module).add(
  'default',
  withInfo('PanelChart')(() => {
    const browsers = [
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
    ];
    const errorSeries = [
      {
        name: 'Handled',
        data: [150, 300, 250, 600, 342, 800, 750],
      },
      {
        name: 'Unhandled',
        data: [50, 200, 150, 300, 102, 283, 341],
      },
    ];
    const errorLines = [
      {
        name: 'Previous',
        data: [650, 300, 350, 300, 400, 250, 200],
      },
    ];

    return (
      <React.Fragment>
        <PanelChart
          title="Pie Chart"
          startDate={new Date()}
          name="Browsers"
          series={browsers}
        >
          <PieChart data={browsers} />
          {({series, title, ...props}) => (
            <PieChart {...props} name={title} data={series} />
          )}
        </PanelChart>

        <PanelChart
          title="Pie Chart"
          startDate={new Date()}
          name="Browsers"
          series={errorSeries}
          lines={errorLines}
        >
          {({title, ...props}) => <AreaChart {...props} name={title} />}
        </PanelChart>
      </React.Fragment>
    );
  })
);
