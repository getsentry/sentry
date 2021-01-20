import React from 'react';

import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import {Series} from 'app/types/echarts';

type Props = {
  data: Series[];
};

const MetricChart = ({data}: Props) => {
  return (
    <LineChart
      isGroupedByDate
      showTimeInTooltip
      grid={{
        left: 0,
        right: 0,
        top: space(2),
        bottom: 0,
      }}
      series={data}
    />
  );
};

export default MetricChart;
