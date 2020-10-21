import {withInfo} from '@storybook/addon-info';

import AreaChart from 'app/components/charts/areaChart';

export default {
  title: 'DataVisualization/Charts/AreaChart',
};

export const _AreaChart = withInfo('Stacked AreaChart with previous period')(() => {
  const TOTAL = 6;
  const NOW = new Date().getTime();
  const getValue = () => Math.round(Math.random() * 1000);
  const getDate = num => NOW - (TOTAL - num) * 86400000;
  const getData = num =>
    [...Array(num)].map((_v, i) => ({value: getValue(), name: getDate(i)}));
  return (
    <div>
      <AreaChart
        style={{height: 250}}
        series={[
          {
            seriesName: 'Handled',
            data: getData(7),
          },
          {
            seriesName: 'Unhandled',
            data: getData(7),
          },
        ]}
        previousPeriod={[
          {
            seriesName: 'Previous',
            data: getData(7),
          },
        ]}
      />
    </div>
  );
});

_AreaChart.story = {
  name: 'AreaChart',
};
