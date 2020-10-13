import React from 'react';
import {EChartOption} from 'echarts';

import theme from 'app/utils/theme';
import {getFormattedDate} from 'app/utils/dates';

import BarChart from './barChart';
import BaseChart from './baseChart';
import {truncationFormatter} from './utils';

type Marker = {
  name: string;
  value: string | number | Date;
  color: string;
  symbolSize?: number;
};

type DefaultProps = {
  /**
   * Colors to use on the chart.
   */
  colors: string[];
  /**
   * Hover state colors to use on the chart.
   */
  emphasisColors: string[];
};

const defaultProps: DefaultProps = {
  colors: [theme.gray300, theme.purple300, theme.purple400],
  emphasisColors: [theme.gray400, theme.purple400, theme.purple500],
};

type Props = React.ComponentProps<typeof BaseChart> &
  DefaultProps & {
    /**
     * Colors to use on the chart.
     */
    colors: string[];
    /**
     * Hover state colors to use on the chart.
     */
    emphasisColors: string[];
    /**
     * A list of series to be rendered as markLine components on the chart
     * This is often used to indicate start/end markers on the xAxis
     */
    markers?: Marker[];
    /**
     * Whether timestamps are should be shown in UTC or local timezone.
     */
    utc?: boolean;
  };

class MiniBarChart extends React.Component<Props> {
  static defaultProps = defaultProps;

  render() {
    const {markers, colors, emphasisColors, series: _series, ...props} = this.props;
    let series = [...this.props.series];

    // Ensure bars overlap and that empty values display as we're disabling the axis lines.
    if (series.length) {
      series = series.map((original, i: number) => {
        const updated: EChartOption.SeriesBar = {...original, cursor: 'normal'};
        if (i === 0) {
          updated.barMinHeight = 1;
          updated.barGap = '-100%';
        }
        if (emphasisColors[i]) {
          updated.emphasis = {
            itemStyle: {
              color: emphasisColors[i],
            },
          };
        }
        return updated;
      });
    }

    if (markers) {
      const markerSeries = {
        seriesName: 'markers',
        data: [],
        markLine: {
          label: {
            show: false,
          },
          symbol: ['circle', 'none'],
          tooltip: {
            trigger: 'item',
            formatter: ({data}) => {
              const time = getFormattedDate(data.value, 'MMM D, YYYY LT', {
                local: !this.props.utc,
              });
              const name = truncationFormatter(data.name, props?.xAxis?.truncate);
              return [
                '<div class="tooltip-series">',
                `<div><span class="tooltip-label"><strong>${name}</strong></span></div>`,
                '</div>',
                '<div class="tooltip-date">',
                time,
                '</div>',
                '</div>',
                '<div class="tooltip-arrow"></div>',
              ].join('');
            },
          },
          data: markers.map((marker: Marker) => {
            return {
              name: marker.name,
              xAxis: marker.value,
              symbolSize: marker.symbolSize ?? 8,
              itemStyle: {
                color: marker.color,
              },
              lineStyle: {
                width: 0,
                emphasis: {
                  width: 0,
                },
              },
            };
          }),
        },
      };
      series.push(markerSeries);
    }

    const chartOptions = {
      colors,
      tooltip: {
        trigger: 'axis',
      },
      yAxis: {
        axisLabel: {
          show: false,
        },
        splitLine: {
          show: false,
        },
      },
      xAxis: {
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
          alignWithLabel: true,
        },
        axisLabel: {
          show: false,
        },
        axisPointer: {
          type: 'line',
          label: {
            show: false,
          },
          lineStyle: {
            width: 0,
          },
        },
      },
    };
    return <BarChart series={series} {...chartOptions} {...props} />;
  }
}

export default MiniBarChart;
