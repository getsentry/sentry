import {ECharts, EChartOption} from 'echarts';
import debounce from 'lodash/debounce';
import maxBy from 'lodash/maxBy';
import React from 'react';

import {ReactEchartsRef, Series, SeriesDataUnit} from 'app/types/echarts';
import Graphic from 'app/components/charts/components/graphic';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

type Props = {
  xAxis: EChartOption.XAxis;
  data: Series[];
  alertThreshold?: number | null;
  resolveThreshold?: number | null;
  isInverted?: boolean;
  maxValue?: number;
};

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

/**
 * This chart displays shaded regions that represent different Trigger thresholds in a
 * Metric Alert rule.
 */
export default class ThresholdsChart extends React.PureComponent<Props, State> {
  static defaultProps = {
    data: [],
  };

  state = {
    width: -1,
    height: -1,
    yAxisMax: null,
  };

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.alertThreshold !== prevProps.alertThreshold ||
      this.props.data !== prevProps.data
    ) {
      this.handleUpdateChartAxis();
    }
  }

  chartRef: null | ECharts = null;

  // If we have ref to chart and data, try to update chart axis so that
  // alertThreshold or resolveThreshold is visible in chart
  handleUpdateChartAxis = () => {
    const {data, alertThreshold, resolveThreshold} = this.props;
    if (
      this.chartRef &&
      data.length &&
      data[0].data &&
      (alertThreshold !== null || resolveThreshold !== null)
    ) {
      this.updateChartAxis(
        Math.max(alertThreshold || 0, resolveThreshold || 0),
        data[0].data
      );
    }
  };

  updateChartAxis = debounce((threshold: number, dataArray: SeriesDataUnit[]) => {
    const max = maxBy(dataArray, ({value}) => value);
    if (typeof max !== 'undefined' && threshold > max.value) {
      // We need to force update after we set a new yAxis max because `convertToPixel` will
      // can return a negitive position (probably because yAxisMax is not synced with chart yet)
      this.setState({yAxisMax: Math.round(threshold * 1.1)}, this.forceUpdate);
    } else {
      this.setState({yAxisMax: null});
    }
  }, 150);

  handleRef = (ref: ReactEchartsRef): void => {
    // When chart initially renders, we want to update state with its width, as well as initialize starting
    // locations (on y axis) for the draggable lines
    if (ref && typeof ref.getEchartsInstance === 'function' && !this.chartRef) {
      this.chartRef = ref.getEchartsInstance();
      const width = this.chartRef.getWidth();
      const height = this.chartRef.getHeight();
      this.handleUpdateChartAxis();
      if (width !== this.state.width || height !== this.state.height) {
        this.setState({
          width,
          height,
        });
      }
    }

    if (!ref) {
      this.chartRef = null;
    }
  };

  getShadedThresholdPosition = (
    isResolution: boolean,
    position: number
    // yAxisPosition: number
  ) => {
    const {isInverted} = this.props;

    // i.e. isInverted xor isResolution
    // We shade the bottom area if:
    // * we are shading the resolution and it is *NOT* inverted
    // * we are shading the incident and it *IS* inverted
    if (isInverted !== isResolution) {
      return [0, position + 1];
    }

    // Otherwise shade the top area (`0,0` coordinates represents top left of chart)
    return [0, 0];
  };

  /**
   * Draws the boundary lines and shaded areas for the chart.
   */
  getThresholdLine = (
    position: string | any[] | null | number,
    isResolution: boolean
  ) => {
    const {alertThreshold, resolveThreshold, isInverted} = this.props;

    if (
      typeof position !== 'number' ||
      (isResolution && resolveThreshold === null) ||
      (!isResolution && alertThreshold === null) ||
      !this.state.height ||
      !this.chartRef
    ) {
      return [];
    }

    const yAxisPixelPosition = this.chartRef.convertToPixel({yAxisIndex: 0}, '0');
    const yAxisPosition = typeof yAxisPixelPosition === 'number' ? yAxisPixelPosition : 0;

    const LINE_STYLE = {
      stroke: theme.purpleLight,
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
      // for incidents (or when they will be considered as resolved)
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
            fill: isResolution ? 'rgba(87, 190, 140, 0.1)' : 'rgba(220, 107, 107, 0.18)',
          },

          // This needs to be below the draggable line
          z: 100,
        },
      ]),
    ];
  };

  render() {
    const {data, xAxis} = this.props;

    const alertThresholdPosition =
      this.chartRef &&
      this.chartRef.convertToPixel({yAxisIndex: 0}, `${this.props.alertThreshold}`);
    const resolveThresholdPosition =
      this.chartRef &&
      this.chartRef.convertToPixel({yAxisIndex: 0}, `${this.props.resolveThreshold}`);

    return (
      <LineChart
        isGroupedByDate
        forwardedRef={this.handleRef}
        grid={CHART_GRID}
        xAxis={xAxis}
        yAxis={{
          max: this.state.yAxisMax,
        }}
        graphic={Graphic({
          elements: [
            ...this.getThresholdLine(alertThresholdPosition, false),
            ...this.getThresholdLine(resolveThresholdPosition, true),
          ],
        })}
        series={data}
      />
    );
  }
}
