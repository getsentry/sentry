import React from 'react';
import color from 'color';
import moment from 'moment';

import Graphic from 'app/components/charts/components/graphic';
import MarkLine from 'app/components/charts/components/markLine';
import LineChart, {LineChartSeries} from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import {ReactEchartsRef, Series} from 'app/types/echarts';
import theme from 'app/utils/theme';
import {IncidentRule, Trigger} from 'app/views/settings/incidentRules/types';

import {Incident} from '../../types';

const X_AXIS_BOUNDARY_GAP = 15;

type Props = {
  data: Series[];
  rule?: IncidentRule;
  incidents?: Incident[];
  warningTrigger?: Trigger;
  criticalTrigger?: Trigger;
};

type State = {
  width: number;
  height: number;
};

function createThresholdSeries(lineColor: string, threshold: number): LineChartSeries {
  const criticalThresholdLine = {
    seriesName: 'Threshold Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'dashed', width: 1},
      data: [{yAxis: threshold} as any],
    }),
    data: [],
  };
  return criticalThresholdLine;
}

export default class MetricChart extends React.PureComponent<Props, State> {
  state = {
    width: -1,
    height: -1,
  };

  ref: null | ReactEchartsRef = null;

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
    }

    if (!ref) {
      this.ref = null;
    }
  };

  getRuleCreatedThresholdElements = () => {
    const {height, width} = this.state;
    const {data, rule} = this.props;

    if (!data.length || !data[0].data.length) {
      return [];
    }

    const seriesData = data[0].data;
    const seriesStart = seriesData[0].name as number;
    const seriesEnd = seriesData[seriesData.length - 1].name as number;
    const ruleCreated = moment(rule?.dateCreated).valueOf();

    const chartWidth = width - X_AXIS_BOUNDARY_GAP;
    const position =
      X_AXIS_BOUNDARY_GAP +
      Math.round((chartWidth * (ruleCreated - seriesStart)) / (seriesEnd - seriesStart));

    return [
      {
        type: 'line',
        draggable: false,
        position: [position, 0],
        shape: {y1: 0, y2: height, x1: 1, x2: 1},
        style: {
          stroke: theme.gray300,
          lineDash: [2],
        },
      },
      {
        type: 'rect',
        draggable: false,
        position: [X_AXIS_BOUNDARY_GAP, 0],
        shape: {
          // +1 makes the gray area go midway onto the dashed line above
          width: position - X_AXIS_BOUNDARY_GAP + 1,
          height,
        },
        style: {
          fill: color(theme.gray300).alpha(0.25).rgb().string(),
        },
        z: 100,
      },
    ];
  };

  render() {
    const {data, incidents, warningTrigger, criticalTrigger} = this.props;

    const series: LineChartSeries[] = [...data];
    // Ensure series data appears above incident lines
    series[0].z = 100;
    const dataArr = data[0].data;
    const maxSeriesValue = dataArr.reduce(
      (currMax, coord) => Math.max(currMax, coord.value),
      0
    );
    const firstPoint = Number(dataArr[0].name);
    const lastPoint = dataArr[dataArr.length - 1].name;
    const resolvedArea = {
      seriesName: 'Resolved Area',
      type: 'line',
      markLine: MarkLine({
        silent: true,
        lineStyle: {color: theme.green300, type: 'solid', width: 4},
        data: [[{coord: [firstPoint, 0]}, {coord: [lastPoint, 0]}] as any],
      }),
      data: [],
    };
    series.push(resolvedArea);
    if (incidents) {
      // select incidents that fall within the graph range
      const periodStart = moment.utc(firstPoint);
      const filteredIncidents = incidents.filter(incident => {
        return !incident.dateClosed || moment(incident.dateClosed).isAfter(periodStart);
      });

      const criticalLines = filteredIncidents.map(incident => {
        const detectTime = Math.max(moment(incident.dateStarted).valueOf(), firstPoint);
        let resolveTime;
        if (incident.dateClosed) {
          resolveTime = moment(incident.dateClosed).valueOf();
        } else {
          resolveTime = lastPoint;
        }
        return [{coord: [detectTime, 0]}, {coord: [resolveTime, 0]}];
      });
      const criticalArea = {
        seriesName: 'Critical Area',
        type: 'line',
        markLine: MarkLine({
          silent: true,
          lineStyle: {color: theme.red300, type: 'solid', width: 4},
          data: criticalLines as any,
        }),
        data: [],
      };
      series.push(criticalArea);

      const incidentValueMap: Record<number, string> = {};
      const incidentLines = filteredIncidents.map(({dateStarted, identifier}) => {
        const incidentStart = moment(dateStarted).valueOf();
        incidentValueMap[incidentStart] = identifier;
        return {xAxis: incidentStart};
      });
      const incidentLinesSeries = {
        seriesName: 'Incident Line',
        type: 'line',
        markLine: MarkLine({
          silent: true,
          lineStyle: {color: theme.red300, type: 'solid'},
          data: incidentLines as any,
          label: {
            show: true,
            position: 'insideEndBottom',
            formatter: ({value}) => {
              return incidentValueMap[value] ?? '-';
            },
            color: theme.red300,
            fontSize: 10,
          } as any,
        }),
        data: [],
      };
      series.push(incidentLinesSeries);
    }

    let maxThresholdValue = 0;
    if (warningTrigger?.alertThreshold) {
      const {alertThreshold} = warningTrigger;
      const warningThresholdLine = createThresholdSeries(theme.yellow300, alertThreshold);
      series.push(warningThresholdLine);
      maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
    }

    if (criticalTrigger?.alertThreshold) {
      const {alertThreshold} = criticalTrigger;
      const criticalThresholdLine = createThresholdSeries(theme.red300, alertThreshold);
      series.push(criticalThresholdLine);
      maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
    }

    return (
      <LineChart
        isGroupedByDate
        showTimeInTooltip
        forwardedRef={this.handleRef}
        grid={{
          left: 0,
          right: 0,
          top: space(2),
          bottom: 0,
        }}
        yAxis={maxThresholdValue > maxSeriesValue ? {max: maxThresholdValue} : undefined}
        series={series}
        graphic={Graphic({
          elements: this.getRuleCreatedThresholdElements(),
        })}
        onFinished={() => {
          // We want to do this whenever the chart finishes re-rendering so that we can update the dimensions of
          // any graphics related to the triggers (e.g. the threshold areas + boundaries)
          this.updateDimensions();
        }}
      />
    );
  }
}
