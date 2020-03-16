import {ECharts} from 'echarts';
import React from 'react';
import color from 'color';
import debounce from 'lodash/debounce';
import flatten from 'lodash/flatten';

import {GlobalSelection} from 'app/types';
import {ReactEchartsRef, Series} from 'app/types/echarts';
import Graphic from 'app/components/charts/components/graphic';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

import {Trigger, AlertRuleThresholdType} from '../../types';

type DefaultProps = {
  data: Series[];
};

type Props = DefaultProps & {
  triggers: Trigger[];
  maxValue?: number;
} & Partial<GlobalSelection['datetime']>;

type State = {
  width: number;
  height: number;
  yAxisMax: number | null;
};

const CHART_GRID = {
  left: space(1),
  right: space(1),
  top: space(2),
  bottom: space(1),
};

// Colors to use for trigger thresholds
const COLOR = {
  RESOLUTION_FILL: color(theme.greenLight)
    .alpha(0.1)
    .rgb()
    .string(),
  CRITICAL_FILL: color(theme.redLight)
    .alpha(0.25)
    .rgb()
    .string(),
  WARNING_FILL: color(theme.yellowLight)
    .alpha(0.1)
    .rgb()
    .string(),
};

/**
 * This chart displays shaded regions that represent different Trigger thresholds in a
 * Metric Alert rule.
 */
export default class ThresholdsChart extends React.PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    data: [],
  };

  state = {
    width: -1,
    height: -1,
    yAxisMax: null,
  };

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.triggers !== prevProps.triggers ||
      this.props.data !== prevProps.data
    ) {
      this.handleUpdateChartAxis();
    }
  }

  chartRef: null | ECharts = null;

  // If we have ref to chart and data, try to update chart axis so that
  // alertThreshold or resolveThreshold is visible in chart
  handleUpdateChartAxis = () => {
    const {triggers} = this.props;
    if (this.chartRef) {
      this.updateChartAxis(
        Math.max(
          ...flatten(
            triggers.map(trigger => [
              trigger.alertThreshold || 0,
              trigger.resolveThreshold || 0,
            ])
          )
        )
      );
    }
  };

  /**
   * Updates the chart so that yAxis is within bounds of our max value
   */
  updateChartAxis = debounce((threshold: number) => {
    const {maxValue} = this.props;
    if (typeof maxValue !== 'undefined' && threshold > maxValue) {
      // We need to force update after we set a new yAxis max because `convertToPixel`
      // can return a negitive position (probably because yAxisMax is not synced with chart yet)
      this.setState({yAxisMax: Math.round(threshold * 1.1)}, this.forceUpdate);
    } else {
      this.setState({yAxisMax: null}, this.forceUpdate);
    }
  }, 150);

  /**
   * Syncs component state with the chart's width/heights
   */
  updateDimensions = (chartRef: ECharts | null = this.chartRef) => {
    if (!chartRef) {
      return;
    }

    const width = chartRef.getWidth();
    const height = chartRef.getHeight();
    if (width !== this.state.width || height !== this.state.height) {
      this.setState({
        width,
        height,
      });
    }
  };

  handleRef = (ref: ReactEchartsRef): void => {
    // When chart initially renders, we want to update state with its width, as well as initialize starting
    // locations (on y axis) for the draggable lines
    if (ref && typeof ref.getEchartsInstance === 'function' && !this.chartRef) {
      this.chartRef = ref.getEchartsInstance();
      this.updateDimensions(this.chartRef);
      this.handleUpdateChartAxis();
    }

    if (!ref) {
      this.chartRef = null;
    }
  };

  /**
   * Draws the boundary lines and shaded areas for the chart.
   *
   * May need to refactor so that they are aware of other trigger thresholds.
   *
   * e.g. draw warning from threshold -> critical threshold instead of the entire height of chart
   */
  getThresholdLine = (
    trigger: Trigger,
    type: 'alertThreshold' | 'resolveThreshold',
    isResolution: boolean
  ) => {
    const {thresholdType} = trigger;
    const position = this.getChartPixelForThreshold(trigger[type]);
    const isInverted = thresholdType === AlertRuleThresholdType.BELOW;

    if (
      typeof position !== 'number' ||
      isNaN(position) ||
      !this.state.height ||
      !this.chartRef
    ) {
      return [];
    }

    const yAxisPixelPosition = this.chartRef.convertToPixel({yAxisIndex: 0}, '0');
    const yAxisPosition = typeof yAxisPixelPosition === 'number' ? yAxisPixelPosition : 0;

    const isCritical = trigger.label === 'critical';
    const LINE_STYLE = {
      stroke: isResolution ? theme.greenDark : isCritical ? theme.redDark : theme.yellow,
      lineDash: [2],
    };

    return [
      // This line is used as a "border" for the shaded region
      // and represents the threshold value.
      {
        type: 'line',
        // Resolution is considered "off" if it is -1
        invisible: position === null,
        draggable: false,
        position: [0, position],
        shape: {y1: 1, y2: 1, x1: 0, x2: this.state.width},
        style: LINE_STYLE,
      },

      // Shaded area for incident/resolutions to show user when they can expect to be alerted
      // (or when they will be considered as resolved)
      //
      // Resolution is considered "off" if it is -1
      ...(position !== null && [
        {
          type: 'rect',
          draggable: false,

          //
          position: isResolution !== isInverted ? [0, position + 1] : [0, 0],
          shape: {
            width: this.state.width,
            height: isResolution !== isInverted ? yAxisPosition - position : position,
          },

          style: {
            fill: isResolution
              ? COLOR.RESOLUTION_FILL
              : isCritical
              ? COLOR.CRITICAL_FILL
              : COLOR.WARNING_FILL,
          },

          // This needs to be below the draggable line
          z: 100,
        },
      ]),
    ];
  };

  getChartPixelForThreshold = (threshold: number | '' | null) =>
    this.chartRef && this.chartRef.convertToPixel({yAxisIndex: 0}, `${threshold}`);

  render() {
    const {data, triggers, period} = this.props;
    const dataWithoutRecentBucket = data?.map(({data: eventData, ...restOfData}) => ({
      ...restOfData,
      data: eventData.slice(0, -1),
    }));

    return (
      <LineChart
        isGroupedByDate
        showTimeInTooltip
        period={period}
        forwardedRef={this.handleRef}
        grid={CHART_GRID}
        yAxis={{
          max: this.state.yAxisMax,
        }}
        graphic={Graphic({
          elements: flatten(
            triggers.map((trigger: Trigger) => [
              ...this.getThresholdLine(trigger, 'alertThreshold', false),
              ...this.getThresholdLine(trigger, 'resolveThreshold', true),
            ])
          ),
        })}
        series={dataWithoutRecentBucket}
        onFinished={() => {
          // We want to do this whenever the chart finishes re-rendering so that we can update the dimensions of
          // any graphics related to the triggers (e.g. the threshold areas + boundaries)
          if (!this.chartRef) {
            return;
          }

          this.updateDimensions(this.chartRef);
        }}
      />
    );
  }
}
