import {Component, createRef} from 'react';
import {Theme, withTheme} from '@emotion/react';
import type {PieSeriesOption} from 'echarts';

import BaseChart, {BaseChartProps} from 'sentry/components/charts/baseChart';
import Legend from 'sentry/components/charts/components/legend';
import PieSeries from 'sentry/components/charts/series/pieSeries';
import {ReactEchartsRef, Series} from 'sentry/types/echarts';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';

export interface PieChartSeries
  extends Series,
    Omit<PieSeriesOption, 'id' | 'color' | 'data'> {}

interface Props extends Omit<BaseChartProps, 'series'> {
  // TODO improve type
  data: any;
  series: PieChartSeries[];
  theme: Theme;
  selectOnRender?: boolean;
}

class PieChart extends Component<Props> {
  componentDidMount() {
    const {selectOnRender} = this.props;

    if (!selectOnRender) {
      return;
    }

    // Timeout is because we need to wait for rendering animation to complete
    // And I haven't found a callback for this
    this.highlightTimeout = window.setTimeout(() => this.highlight(0), 1000);
  }

  componentWillUnmount() {
    window.clearTimeout(this.highlightTimeout);
  }

  highlightTimeout: number | undefined = undefined;
  isInitialSelected = true;
  selected = 0;
  chart = createRef<ReactEchartsRef>();

  // Select a series to highlight (e.g. shows details of series)
  // This is the same event as when you hover over a series in the chart
  highlight = dataIndex => {
    if (!this.chart.current) {
      return;
    }
    this.chart.current.getEchartsInstance().dispatchAction({
      type: 'highlight',
      seriesIndex: 0,
      dataIndex,
    });
  };

  // Opposite of `highlight`
  downplay = dataIndex => {
    if (!this.chart.current) {
      return;
    }

    this.chart.current.getEchartsInstance().dispatchAction({
      type: 'downplay',
      seriesIndex: 0,
      dataIndex,
    });
  };

  // echarts Legend does not have access to percentages (but tooltip does :/)
  getSeriesPercentages = (series: PieChartSeries) => {
    const total = series.data.reduce((acc, {value}) => acc + value, 0);
    return series.data
      .map(({name, value}) => [name, Math.round((value / total) * 10000) / 100])
      .reduce(
        (acc, [name, value]) => ({
          ...acc,
          [name]: value,
        }),
        {}
      );
  };

  render() {
    const {series, theme, ...props} = this.props;
    if (!series || !series.length) {
      return null;
    }
    if (series.length > 1) {
      // eslint-disable-next-line no-console
      console.warn('PieChart only uses the first series!');
    }

    // Note, we only take the first series unit!
    const [firstSeries] = series;

    return (
      <BaseChart
        ref={this.chart}
        colors={[...theme.charts.getColorPalette(5)].reverse()}
        // when legend highlights it does NOT pass dataIndex :(
        onHighlight={({name}) => {
          if (
            !this.isInitialSelected ||
            !name ||
            firstSeries.data[this.selected].name === name
          ) {
            return;
          }

          // Unhighlight if not initial "highlight" event and
          // if name exists (i.e. not dispatched from cDM) and
          // highlighted series name is different than the initially selected series name
          this.downplay(this.selected);
          this.isInitialSelected = false;
        }}
        onMouseOver={({dataIndex}) => {
          if (!this.isInitialSelected) {
            return;
          }
          if (dataIndex === this.selected) {
            return;
          }
          this.downplay(this.selected);
          this.isInitialSelected = false;
        }}
        {...props}
        legend={Legend({
          theme,
          orient: 'vertical',
          align: 'left',
          show: true,
          right: 0,
          top: 10,
          formatter: name => {
            return `${name} ${
              this.props.data
                ? getDuration(this.props.data[name].newBaseline / 1000, 2, true)
                : ''
            } ${
              this.props.data
                ? formatPercentage(
                    this.props.data[name].oldBaseline /
                      this.props.data[name].newBaseline -
                      1
                  )
                : ''
            }`;
          },
        })}
        tooltip={{
          formatter: data => {
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label">${data.marker}<strong>${data.name}</strong></span></div>`,
              '</div>',
              `<div class="tooltip-footer">${getDuration(
                this.props.data[data.name].oldBaseline / 1000,
                2,
                true
              )} to ${getDuration(
                this.props.data[data.name].newBaseline / 1000,
                2,
                true
              )}</div>`,
              '</div>',
              '<div class="tooltip-arrow"></div>',
            ].join('');
          },
        }}
        series={[
          PieSeries({
            name: firstSeries.seriesName,
            data: firstSeries.data,
            avoidLabelOverlap: false,
            label: {
              position: 'inner',
              // TODO show labels after they're styled
              formatter: () => '',
              show: false,
            },
            emphasis: {
              label: {
                show: true,
              },
            },
            labelLine: {
              show: false,
            },
          }),
        ]}
        xAxis={null}
        yAxis={null}
      />
    );
  }
}

export default withTheme(PieChart);
