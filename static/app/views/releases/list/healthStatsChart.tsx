import LazyLoad from 'react-lazyload';
import {useTheme} from '@emotion/react';

import MiniBarChart from 'app/components/charts/miniBarChart';
import {tn} from 'app/locale';
import {Series} from 'app/types/echarts';

import {DisplayOption} from './utils';

type Props = {
  activeDisplay: DisplayOption;
  data: Series[];
  height?: number;
};

function HealthStatsChart({activeDisplay, data, height = 24}: Props) {
  const theme = useTheme();

  const formatTooltip = (value: number) => {
    const suffix =
      activeDisplay === DisplayOption.USERS
        ? tn('user', 'users', value)
        : tn('session', 'sessions', value);

    return `${value.toLocaleString()} ${suffix}`;
  };

  return (
    <LazyLoad debounce={50} height={height}>
      <MiniBarChart
        series={data}
        height={height}
        isGroupedByDate
        showTimeInTooltip
        hideDelay={50}
        tooltipFormatter={formatTooltip}
        colors={[theme.purple300, theme.gray200]}
      />
    </LazyLoad>
  );
}

export default HealthStatsChart;
