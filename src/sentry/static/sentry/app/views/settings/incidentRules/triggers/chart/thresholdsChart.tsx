import React from 'react';
import color from 'color';
import debounce from 'lodash/debounce';
import flatten from 'lodash/flatten';

import Graphic from 'app/components/charts/components/graphic';
import LineChart, {LineChartSeries} from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import {GlobalSelection} from 'app/types';
import {ReactEchartsRef, Series} from 'app/types/echarts';
import theme from 'app/utils/theme';

import {AlertRuleThresholdType, IncidentRule, Trigger} from '../../types';

type DefaultProps = {
  data: Series[];
};

type Props = DefaultProps & {
  triggers: Trigger[];
  resolveThreshold: IncidentRule['resolveThreshold'];
  thresholdType: IncidentRule['thresholdType'];
  maxValue?: number;
} & Partial<GlobalSelection['datetime']>;

type State = {
  width: number;
  height: number;
  yAxisMax: number | null;
};

const CHART_GRID = {
  left: space(2),
  right: space(2),
  top: space(4),
  bottom: space(2),
};

// Colors to use for trigger thresholds
const COLOR = {
  RESOLUTION_FILL: color(theme.green200).alpha(0.1).rgb().string(),
  CRITICAL_FILL: color(theme.red300).alpha(0.25).rgb().string(),
  WARNING_FILL: color(theme.yellow200).alpha(0.1).rgb().string(),
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

  ref: null | ReactEchartsRef = null;

  // If we have ref to chart and data, try to update chart axis so that
  // alertThreshold or resolveThreshold is visible in chart
  handleUpdateChartAxis = () => {
    const {triggers, resolveThreshold} = this.props;
    const chartRef = this.ref?.getEchartsInstance?.();
    if (chartRef) {
      this.updateChartAxis(
        Math.max(
          ...flatten(
            triggers.map(trigger => [trigger.alertThreshold || 0, resolveThreshold || 0])
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
  updateDimensions = () => {
    const chartRef = this.ref?.getEchartsInstance?.();
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
    if (ref && !this.ref) {
      this.ref = ref;
      this.updateDimensions();
      this.handleUpdateChartAxis();
    }

    if (!ref) {
      this.ref = null;
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
    const {thresholdType, resolveThreshold, maxValue} = this.props;
    const position =
      type === 'alertThreshold'
        ? this.getChartPixelForThreshold(trigger[type])
        : this.getChartPixelForThreshold(resolveThreshold);
    const isInverted = thresholdType === AlertRuleThresholdType.BELOW;
    const chartRef = this.ref?.getEchartsInstance?.();

    if (
      typeof position !== 'number' ||
      isNaN(position) ||
      !this.state.height ||
      !chartRef
    ) {
      return [];
    }

    const yAxisPixelPosition = chartRef.convertToPixel({yAxisIndex: 0}, '0');
    const yAxisPosition = typeof yAxisPixelPosition === 'number' ? yAxisPixelPosition : 0;
    // As the yAxis gets larger we want to start our line/area further to the right
    // Handle case where the graph max is 1 and includes decimals
    const yAxisMax =
      (Math.round(Math.max(maxValue ?? 1, this.state.yAxisMax ?? 1)) * 100) / 100;
    const yAxisSize = 15 + (yAxisMax <= 1 ? 15 : `${yAxisMax ?? ''}`.length * 8);
    // Shave off the right margin and yAxisSize from the width to get the actual area we want to render content in
    const graphAreaWidth =
      this.state.width - parseInt(CHART_GRID.right.slice(0, -2), 10) - yAxisSize;
    // Distance from the top of the chart to save for the legend
    const legendPadding = 20;

    const isCritical = trigger.label === 'critical';
    const LINE_STYLE = {
      stroke: isResolution ? theme.green300 : isCritical ? theme.red300 : theme.yellow300,
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
        position: [yAxisSize, position],
        shape: {y1: 1, y2: 1, x1: 0, x2: graphAreaWidth},
        style: LINE_STYLE,
      },

      // Shaded area for incident/resolutions to show user when they can expect to be alerted
      // (or when they will be considered as resolved)
      //
      // Resolution is considered "off" if it is -1
      ...(position !== null
        ? [
            {
              type: 'rect',
              draggable: false,

              position:
                isResolution !== isInverted
                  ? [yAxisSize, position + 1]
                  : [yAxisSize, legendPadding],
              shape: {
                width: graphAreaWidth,
                height:
                  isResolution !== isInverted
                    ? yAxisPosition - position
                    : position - legendPadding,
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
          ]
        : []),
    ];
  };

  getChartPixelForThreshold = (threshold: number | '' | null) => {
    const chartRef = this.ref?.getEchartsInstance?.();
    return (
      threshold !== '' &&
      chartRef &&
      chartRef.convertToPixel({yAxisIndex: 0}, `${threshold}`)
    );
  };

  render() {
    const {data, triggers, period} = this.props;
    const dataWithoutRecentBucket: LineChartSeries[] = data?.map(
      ({data: eventData, ...restOfData}) => ({
        ...restOfData,
        data: eventData.slice(0, -1),
      })
    );

    // Disable all lines by default but the 1st one
    const selected: Record<string, boolean> = dataWithoutRecentBucket.reduce(
      (acc, {seriesName}, index) => {
        acc[seriesName] = index === 0;
        return acc;
      },
      {}
    );
    const legend = {
      right: 10,
      top: 0,
      selected,
    };

    return (
      <LineChart
        isGroupedByDate
        showTimeInTooltip
        period={period}
        forwardedRef={this.handleRef}
        grid={CHART_GRID}
        yAxis={{
          max: this.state.yAxisMax ?? undefined,
        }}
        legend={legend}
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
          this.updateDimensions();
        }}
      />
    );
  }
}
