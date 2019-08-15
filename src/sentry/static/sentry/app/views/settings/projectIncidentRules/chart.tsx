import {ECharts} from 'echarts';
import {debounce, maxBy} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import {ReactEchartsRef, Series, SeriesDataUnit} from 'app/types/echarts';
import {Panel} from 'app/components/panels';
import Graphic from 'app/components/charts/components/graphic';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';

type Props = {
  data: Series[];
  onChangeUpperBound: (upperBound: number) => void;
  upperBound: number;
};
type State = {
  width: number;
  yAxisMax: number | null;
};

export default class IncidentRulesChart extends React.Component<Props, State> {
  static defaultProps = {
    data: [],
  };

  state = {
    width: -1,
    yAxisMax: null,
  };

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.upperBound !== prevProps.upperBound ||
      this.props.data !== prevProps.data
    ) {
      this.handleUpdateChartAxis();
    }
  }

  chartRef: null | ECharts = null;

  // If we have ref to chart and data, try to update chart axis so that
  // upperBound is visible in chart
  handleUpdateChartAxis = () => {
    const {data, upperBound} = this.props;
    if (this.chartRef && data.length && data[0].data) {
      this.updateChartAxis(upperBound, data[0].data);
    }
  };

  updateChartAxis = debounce((upperBound, dataArray: SeriesDataUnit[]) => {
    const max = maxBy(dataArray, ({value}) => value);
    if (typeof max !== 'undefined' && upperBound > max) {
      // We need to force update after we set a new yAxis max because `convertToPixel` will
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
      this.handleUpdateChartAxis();
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
