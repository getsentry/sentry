import React from 'react';
import {EChartOption} from 'echarts';
import set from 'lodash/set';

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

const defaultProps = {
  /**
   * Colors to use on the chart.
   */
  colors: [theme.gray400, theme.purple400, theme.purple500] as string[],
};

type Props = React.ComponentProps<typeof BaseChart> &
  typeof defaultProps & {
    /**
     * A list of series to be rendered as markLine components on the chart
     * This is often used to indicate start/end markers on the xAxis
     */
    markers?: Marker[];
    /**
     * Whether timestamps are should be shown in UTC or local timezone.
     */
    utc?: boolean;
    /**
     * A list of colors to use on hover.
     * By default hover state will shift opacity from 0.6 to 1.0.
     * You can use this prop to also shift colors on hover.
     */
    emphasisColors?: string[];
  };

class MiniBarChart extends React.Component<Props> {
  static defaultProps = defaultProps;

  render() {
    const {markers, emphasisColors, colors, series: _series, ...props} = this.props;
    let series = [...this.props.series];

    // Ensure bars overlap and that empty values display as we're disabling the axis lines.
    if (series.length) {
      series = series.map((original, i: number) => {
        const updated = {
          ...original,
          cursor: 'normal',
          type: 'bar',
        } as EChartOption.SeriesBar;

        if (i === 0) {
          updated.barMinHeight = 1;
          updated.barGap = '-100%';
        }
        set(updated, 'itemStyle.opacity', 0.6);
        set(updated, 'itemStyle.emphasis.opacity', 1.0);
        if (emphasisColors && emphasisColors[i]) {
          set(updated, 'itemStyle.emphasis.color', emphasisColors[i]);
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
        max(value) {
          // This keeps small datasets from looking 'scary'
          // by having full bars for < 10 values.
          return Math.max(10, value.max);
        },
        axisLabel: {
          show: false,
        },
        splitLine: {
          show: false,
        },
      },
      grid: {
        top: 0,
        // Offset to ensure there is room for the marker symbols at the
        // default size.
        bottom: markers ? 4 : 0,
        left: markers ? 4 : 0,
        right: markers ? 4 : 0,
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
      options: {
        animation: false,
      },
    };
    return <BarChart series={series} {...chartOptions} {...props} />;
  }
}

export default MiniBarChart;
