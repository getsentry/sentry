import {ECharts} from 'echarts';
import {debounce} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import {ReactEchartsRef} from 'app/types/echarts';
import {Panel} from 'app/components/panels';
import Graphic from 'app/components/charts/components/graphic';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';

type DataArray = Array<[number, number]>;

type Props = {
  data: Array<{
    seriesName: string;
    dataArray: DataArray;
  }>;
  onChangeUpperBound: Function;
  upperBound: number;
};
type State = {
  width: number;
  yAxisMax: number | null;
};

const findMax = (data: DataArray): number =>
  data.reduce((max, [_ts, number]) => (number > max ? number : max), 0);

export default class IncidentRulesChart extends React.Component<Props, State> {
  static defaultProps = {
    data: [],
  };

  state = {
    width: -1,
    yAxisMax: null,
  };

  componentDidUpdate(prevProps: Props) {
    const {data, upperBound} = this.props;
    if (
      upperBound !== prevProps.upperBound &&
      this.chartRef &&
      data.length &&
      data[0].dataArray
    ) {
      this.updateChartAxis(upperBound, data[0].dataArray);
    }
  }

  chartRef: null | ECharts = null;

  updateChartAxis = debounce((upperBound, dataArray) => {
    if (upperBound > findMax(dataArray)) {
      // We need to force update after we set a new yAxis max because `converToPixel` will
      // can return a negitive position (probably because yAxisMax is not synced with chart yet)
      this.setState({yAxisMax: Math.round(upperBound * 1.1)}, this.forceUpdate);
    } else {
      this.setState({yAxisMax: null});
    }
  }, 150);

  setUpperBound = (pos: [number, number]) => {
    if (!this.chartRef) {
      return;
    }

    const upperBound = this.chartRef.convertFromPixel({gridIndex: 0}, pos)[1];
    this.props.onChangeUpperBound(upperBound);
  };

  handleRef = (ref: ReactEchartsRef): void => {
    // When chart initially renders, we want to update state with its width, as well as initialize starting
    // locations (on y axis) for the draggable lines
    if (ref && typeof ref.getEchartsInstance === 'function' && !this.chartRef) {
      this.chartRef = ref.getEchartsInstance();
      const width = this.chartRef.getWidth();
      if (width !== this.state.width) {
        this.setState({
          width,
        });
      }
    }

    if (!ref) {
      this.chartRef = null;
    }
  };

  handleUpperBoundDrag = _e => {};

  handleLowerBoundDrag = () => {};

  render() {
    const {width} = this.state;

    const upperBoundPosition =
      this.chartRef &&
      this.chartRef.convertToPixel({yAxisIndex: 0}, `${this.props.upperBound}`);

    return (
      <ChartPanel>
        <LineChart
          isGroupedByDate
          forwardedRef={this.handleRef}
          yAxis={{
            max: this.state.yAxisMax,
          }}
          graphic={Graphic({
            elements: [
              {
                type: 'line',
                invisible: false,
                draggable: true,
                position: [0, upperBoundPosition],
                shape: {y1: 1, y2: 1, x1: -width, x2: width * 2},
                ondragend: e => {
                  this.setUpperBound(e.target.position);
                },
                z: 100,
              },
              {
                type: 'line',
                draggable: false,
                position: [0, upperBoundPosition],
                shape: {y1: 1, y2: 1, x1: 0, x2: width},
                ondrag: () => {},
              },
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
  padding: 0 ${space(1)};
`;
