import {Component, createRef} from 'react';
import {Theme, withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {PieSeriesOption} from 'echarts';

import BaseChart, {BaseChartProps} from 'sentry/components/charts/baseChart';
import PieSeries from 'sentry/components/charts/series/pieSeries';
import CircleIndicator from 'sentry/components/circleIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
  pieChartSliceColors = [...this.props.theme.charts.getColorPalette(5)].reverse();

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

  getSpanOpDurationChange = (op: string) => {
    return this.props.data[op].oldBaseline / this.props.data[op].newBaseline - 1;
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

    // Attach a color to each operation. This allows us to match custom legend indicator
    // colors to the op's pie chart color AND display the legend items sorted based on their
    // percentage changes.
    const operationToColorMap: {
      [key: string]: {color: string; index: number};
    } = {};
    firstSeries.data.forEach((seriesRow, index) => {
      operationToColorMap[seriesRow.name] = {
        color: this.pieChartSliceColors[index],
        index,
      };
    });

    return (
      <Wrapper>
        <LegendWrapper>
          {[...Object.keys(this.props.data)]
            .sort((a, b) => {
              return this.getSpanOpDurationChange(a) - this.getSpanOpDurationChange(b);
            })
            .map((op, index) => {
              const change = this.getSpanOpDurationChange(op);
              const oldValue = getDuration(
                this.props.data[op].oldBaseline / 1000,
                2,
                true
              );
              const newValue = getDuration(
                this.props.data[op].newBaseline / 1000,
                2,
                true
              );
              const percentage = this.props.data
                ? formatPercentage(Math.abs(change))
                : '';
              const percentageText = change < 0 ? t('up') : t('down');
              return (
                <StyledLegendWrapper
                  key={index}
                  onMouseEnter={() => this.highlight(operationToColorMap[op].index)}
                  onMouseLeave={() => this.downplay(operationToColorMap[op].index)}
                >
                  <CircleIndicator color={operationToColorMap[op].color} size={10} />
                  <span>
                    {op}{' '}
                    <Tooltip
                      skipWrapper
                      title={t(
                        `Total time for %s went %s from %s to %s`,
                        op,
                        percentageText,
                        oldValue,
                        newValue
                      )}
                    >
                      <SpanOpChange regressed>
                        {percentageText} {percentage}
                      </SpanOpChange>
                    </Tooltip>
                  </span>
                </StyledLegendWrapper>
              );
            })}
        </LegendWrapper>
        <BaseChart
          ref={this.chart}
          colors={this.pieChartSliceColors}
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
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  position: relative;
`;

const LegendWrapper = styled('div')`
  position: absolute;
  top: 70px;
  left: 185px;
  z-index: 100;
`;

const StyledLegendWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const SpanOpChange = styled('span')<{regressed: boolean}>`
  color: ${p => (p.regressed ? p.theme.red300 : p.theme.green300)};
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-transform: capitalize;
`;

export default withTheme(PieChart);
