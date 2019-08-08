import {ECharts} from 'echarts';
import {debounce, maxBy} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import {ReactEchartsRef, Series, SeriesDataUnit} from 'app/types/echarts';
import {Panel} from 'app/components/panels';
import Graphic from 'app/components/charts/components/graphic';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

type Props = {
  data: Series[];
  alertThreshold: number;
  resolveThreshold: number;
  isInverted: boolean;
  onChangeIncidentThreshold: (alertThreshold: number) => void;
  onChangeResolutionThreshold: (resolveThreshold: number) => void;
};

type State = {
  width: number;
  height: number;
  yAxisMax: number | null;
};

export default class IncidentRulesChart extends React.Component<Props, State> {
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
  // alertThreshold is visible in chart
  handleUpdateChartAxis = () => {
    const {data, alertThreshold} = this.props;
    if (this.chartRef && data.length && data[0].data) {
      this.updateChartAxis(alertThreshold, data[0].data);
    }
  };

  updateChartAxis = debounce((alertThreshold, dataArray: SeriesDataUnit[]) => {
    const max = maxBy(dataArray, ({value}) => value);
    if (typeof max !== 'undefined' && alertThreshold > max) {
      // We need to force update after we set a new yAxis max because `convertToPixel` will
      // can return a negitive position (probably because yAxisMax is not synced with chart yet)
      this.setState({yAxisMax: Math.round(alertThreshold * 1.1)}, this.forceUpdate);
    } else {
      this.setState({yAxisMax: null});
    }
  }, 150);

  setIncidentThreshold = (pos: [number, number]) => {
    if (!this.chartRef) {
      return;
    }

    const alertThreshold = this.chartRef.convertFromPixel({gridIndex: 0}, pos)[1];
    this.props.onChangeIncidentThreshold(alertThreshold);
  };

  setResolutionThreshold = (pos: [number, number]) => {
    if (!this.chartRef) {
      return;
    }

    const boundary = this.chartRef.convertFromPixel({gridIndex: 0}, pos)[1];
    this.props.onChangeResolutionThreshold(boundary);
  };

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

    if (!isInverted) {
      if (isResolution) {
        return [0, position + 1];
      } else {
        return [0, 0];
      }
    } else {
      if (isResolution) {
        return [0, 0];
      } else {
        return [0, position + 1];
      }
    }
  };

  /**
   * Draws the boundary lines and shaded areas for the chart.
   */
  getThresholdLine = (
    position: string | any[] | null | number,
    isResolution: boolean,
    setFn: Function
  ) => {
    const {resolveThreshold, isInverted} = this.props;

    if (
      typeof position !== 'number' ||
      !this.state.height ||
      !this.chartRef ||
      (isResolution && resolveThreshold < 0)
    ) {
      return [];
    }

    const yAxisPixelPosition = this.chartRef.convertToPixel({yAxisIndex: 0}, '0');
    const yAxisPosition = typeof yAxisPixelPosition === 'number' ? yAxisPixelPosition : 0;

    return [
      {
        type: 'line',
        invisible: position === -1,
        draggable: true,
        position: [0, position],
        shape: {y1: 1, y2: 1, x1: -this.state.width, x2: this.state.width * 2},
        style: {
          stroke: theme.purpleLight,
          lineDash: [2],
        },
        ondragend: e => {
          setFn(e.target.position);
        },
        z: 101,
      },
      ...(position >= 0 && [
        {
          type: 'rect',
          draggable: false,
          position: isResolution !== isInverted ? [0, position + 1] : [0, 0],
          shape: {
            width: this.state.width,
            height: isResolution !== isInverted ? yAxisPosition - position : position,
          },

          style: {
            fill: isResolution ? 'rgba(87, 190, 140, 0.1)' : 'rgba(220, 107, 107, 0.18)',
          },
          z: 100,
        },
      ]),
      {
        type: 'line',
        invisible: position === -1,
        draggable: false,
        position: [0, position],
        shape: {y1: 1, y2: 1, x1: 0, x2: this.state.width},
        style: {
          stroke: theme.purple,
          lineDash: [2],
        },
      },
    ];
  };

  render() {
    const alertThresholdPosition =
      this.chartRef &&
      this.chartRef.convertToPixel({yAxisIndex: 0}, `${this.props.alertThreshold}`);
    const resolveThresholdPosition =
      this.chartRef &&
      this.chartRef.convertToPixel({yAxisIndex: 0}, `${this.props.resolveThreshold}`);

    return (
      <ChartPanel>
        <LineChart
          isGroupedByDate
          forwardedRef={this.handleRef}
          grid={{
            left: space(1),
            right: space(1),
            top: space(2),
            bottom: space(1),
          }}
          yAxis={{
            max: this.state.yAxisMax,
            boundaryGddap: [8, 8],
          }}
          graphic={Graphic({
            elements: [
              ...this.getThresholdLine(
                alertThresholdPosition,
                false,
                this.setIncidentThreshold
              ),
              ...this.getThresholdLine(
                resolveThresholdPosition,
                true,
                this.setResolutionThreshold
              ),
            ],
          })}
          series={this.props.data}
        />
      </ChartPanel>
    );
  }
}

const ChartPanel = styled(Panel)`
  background-color: white;
  margin-bottom: ${space(1)};
`;
