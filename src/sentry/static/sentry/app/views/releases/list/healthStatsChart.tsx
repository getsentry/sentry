import React from 'react';
import LazyLoad from 'react-lazyload';
import {withTheme} from 'emotion-theming';

import MiniBarChart from 'app/components/charts/miniBarChart';
import {tn} from 'app/locale';
import {Series} from 'app/types/echarts';
import {Theme} from 'app/utils/theme';

import {DisplayOption} from './utils';

type DefaultProps = {
  height: number;
};

type Props = DefaultProps & {
  activeDisplay: DisplayOption;
  data: Series[];
  theme: Theme;
};

class HealthStatsChart extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    height: 24,
  };

  formatTooltip = (value: number) => {
    const {activeDisplay} = this.props;

    const suffix =
      activeDisplay === DisplayOption.USERS
        ? tn('user', 'users', value)
        : tn('session', 'sessions', value);

    return `${value.toLocaleString()} ${suffix}`;
  };

  render() {
    const {height, data, theme} = this.props;

    return (
      <LazyLoad debounce={50} height={height}>
        <MiniBarChart
          series={data}
          height={height}
          isGroupedByDate
          showTimeInTooltip
          hideDelay={50}
          tooltipFormatter={this.formatTooltip}
          colors={[theme.purple300, theme.gray200]}
        />
      </LazyLoad>
    );
  }
}

export default withTheme(HealthStatsChart);
