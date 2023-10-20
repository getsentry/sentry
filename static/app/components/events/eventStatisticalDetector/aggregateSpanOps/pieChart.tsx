import {Component, createRef} from 'react';
import {Theme, withTheme} from '@emotion/react';
import type {PieSeriesOption} from 'echarts';

import BaseChart, {BaseChartProps} from 'sentry/components/charts/baseChart';
import Legend from 'sentry/components/charts/components/legend';
import PieSeries from 'sentry/components/charts/series/pieSeries';
import {t} from 'sentry/locale';
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
          data: [
            ...Object.keys(this.props.data).sort((a, b) => {
              const changeA =
                this.props.data[a].oldBaseline / this.props.data[a].newBaseline - 1;
              const changeB =
                this.props.data[b].oldBaseline / this.props.data[b].newBaseline - 1;
              return changeA - changeB;
            }),
          ],
          orient: 'vertical',
          show: true,
          left: 185,
          top: '35%',
          textStyle: {
            fontSize: 14,
            fontWeight: 600,
            rich: {
              redText: {
                color: theme.red300,
                fontWeight: 600,
                fontSize: 14,
                backgroundColor: {
                  image: new Image(),
                },
              },
              greenText: {
                color: theme.green300,
                fontWeight: 600,
                fontSize: 14,
              },
              smalltext: {
                color: theme.textColor,
                fontSize: 10,
                verticalAlign: 'bottom',
              },
            },
          },
          itemWidth: 12,
          formatter: name => {
            const change =
              this.props.data[name].oldBaseline / this.props.data[name].newBaseline - 1;
            const oldValue = getDuration(
              this.props.data[name].oldBaseline / 1000,
              2,
              true
            );
            const newValue = getDuration(
              this.props.data[name].newBaseline / 1000,
              2,
              true
            );
            const percentage = this.props.data ? formatPercentage(Math.abs(change)) : '';
            const percentageText = change < 0 ? t('Up') : t('Down');
            const textclass = change < 0 ? t('redText') : t('greenText');

            return `${name}   {${textclass}|${percentageText} ${percentage}} {smalltext|(${oldValue} to ${newValue})}`;
          },
          tooltip: {
            formatter: data => {
              const change =
                this.props.data[data.name].oldBaseline /
                  this.props.data[data.name].newBaseline -
                1;
              const changeText = change < 0 ? t('up') : t('down');
              const oldValue = getDuration(
                this.props.data[data.name].oldBaseline / 1000,
                2,
                true
              );
              const newValue = getDuration(
                this.props.data[data.name].newBaseline / 1000,
                2,
                true
              );

              const text = t(
                `Total time for %s  went %s from %s to %s`,
                data.name,
                changeText,
                oldValue,
                newValue
              );

              return [
                '<div class="tooltip-series">',
                `<div>
                  <span
                    class="tooltip-label"
                    style="
                      width: 200px !important;
                      text-wrap: balance;
                      text-align: center;
                    "
                  >
                    <strong>${text}</strong>
                  </span>
                </div>`,
                '</div>',
                '<div class="tooltip-arrow"></div>',
              ].join('');
            },
            show: true,
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
              position: 'inside',
              formatter: params => {
                return `${Math.round(Number(params.percent))}%`;
              },
              show: true,
              color: theme.background,
              fontSize: 12,
              fontWeight: 600,
            },
            emphasis: {
              label: {
                show: true,
              },
            },
            labelLine: {
              show: false,
            },
            center: ['90', '100'],
            radius: ['45%', '85%'],
            itemStyle: {
              borderColor: theme.background,
              borderWidth: 2,
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
