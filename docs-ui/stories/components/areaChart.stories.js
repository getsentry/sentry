import styled from '@emotion/styled';

import AreaChart from 'sentry/components/charts/areaChart';
import space from 'sentry/styles/space';

export default {
  title: 'Components/Data Visualization/Charts/Area Chart',
  component: AreaChart,
  parameters: {
    controls: {hideNoControlsWarning: true},
  },
};

export const _AreaChart = () => {
  const TOTAL = 6;
  const NOW = new Date().getTime();
  const getValue = () => Math.round(Math.random() * 1000);
  const getDate = num => NOW - (TOTAL - num) * 86400000;
  const getData = num =>
    [...Array(num)].map((_v, i) => ({value: getValue(), name: getDate(i)}));
  return (
    <Container>
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
    </Container>
  );
};

_AreaChart.storyName = 'Area Chart';
_AreaChart.parameters = {
  docs: {
    description: {
      story: 'Stacked AreaChart with previous period',
    },
  },
};

const Container = styled('div')`
  padding: 100px ${space(2)} 0;
`;
