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

import {Incident, IncidentActivityType, IncidentStatus} from '../../types';

const X_AXIS_BOUNDARY_GAP = 15;
const VERTICAL_PADDING = 22;

type Props = {
  data: Series[];
  rule: IncidentRule;
  incidents?: Incident[];
  warningTrigger?: Trigger;
  criticalTrigger?: Trigger;
};

type State = {
  width: number;
  height: number;
};

function createThresholdSeries(lineColor: string, threshold: number): LineChartSeries {
  return {
    seriesName: 'Threshold Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'dashed', width: 1},
      data: [{yAxis: threshold} as any],
    }),
    data: [],
  };
}

function createStatusAreaSeries(
  lineColor: string,
  startTime: number,
  endTime: number
): LineChartSeries {
  return {
    seriesName: 'Status Area',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'solid', width: 4},
      data: [[{coord: [startTime, 0]}, {coord: [endTime, 0]}] as any],
    }),
    data: [],
  };
}

function createIncidentSeries(
  lineColor: string,
  incidentTimestamp: number,
  label?: string
) {
  return {
    seriesName: 'Incident Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'solid'},
      data: [{xAxis: incidentTimestamp}] as any,
      label: {
        show: !!label,
        position: 'insideEndBottom',
        formatter: label || '-',
        color: lineColor,
        fontSize: 10,
      } as any,
    }),
    data: [],
  };
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
    const {
      data,
      rule: {dateModified},
    } = this.props;

    if (!data.length || !data[0].data.length) {
      return [];
    }

    const seriesData = data[0].data;
    const seriesStart = seriesData[0].name as number;
    const seriesEnd = seriesData[seriesData.length - 1].name as number;
    const ruleChanged = moment(dateModified).valueOf();

    if (ruleChanged < seriesStart) {
      return [];
    }

    const chartWidth = width - X_AXIS_BOUNDARY_GAP;
    const position =
      X_AXIS_BOUNDARY_GAP +
      Math.round((chartWidth * (ruleChanged - seriesStart)) / (seriesEnd - seriesStart));

    return [
      {
        type: 'line',
        draggable: false,
        position: [position, 0],
        shape: {y1: 0, y2: height - VERTICAL_PADDING, x1: 1, x2: 1},
        style: {
          stroke: theme.gray200,
        },
      },
      {
        type: 'rect',
        draggable: false,
        position: [X_AXIS_BOUNDARY_GAP, 0],
        shape: {
          // +1 makes the gray area go midway onto the dashed line above
          width: position - X_AXIS_BOUNDARY_GAP + 1,
          height: height - VERTICAL_PADDING,
        },
        style: {
          fill: color(theme.gray100).alpha(0.42).rgb().string(),
        },
        z: 100,
      },
    ];
  };

  render() {
    const {data, incidents, rule, warningTrigger, criticalTrigger} = this.props;

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

      incidents
        .filter(
          incident =>
            !incident.dateClosed || moment(incident.dateClosed).isAfter(periodStart)
        )
        .forEach(incident => {
          const statusChanges = incident.activities
            ?.filter(
              ({type, value}) =>
                type === IncidentActivityType.STATUS_CHANGE &&
                value &&
                [`${IncidentStatus.WARNING}`, `${IncidentStatus.CRITICAL}`].includes(
                  value
                )
            )
            .sort(
              (a, b) => moment(a.dateCreated).valueOf() - moment(b.dateCreated).valueOf()
            );

          const incidentEnd = incident.dateClosed ?? moment().valueOf();

          const timeWindowMs = rule.timeWindow * 60 * 1000;

          let currColor: string = rule.triggers.find(({label}) => label === 'warning')
            ? theme.yellow300
            : theme.red300;
          series.push(
            createIncidentSeries(
              theme.yellow300,
              moment(incident.dateStarted).valueOf(),
              incident.identifier
            )
          );
          series.push(
            createStatusAreaSeries(
              currColor,
              moment(incident.dateStarted).valueOf(),
              statusChanges?.length && statusChanges[0].dateCreated
                ? moment(statusChanges[0].dateCreated).valueOf() - timeWindowMs
                : moment(incidentEnd).valueOf()
            )
          );

          statusChanges?.forEach((activity, idx) => {
            const dateCreated = moment(activity.dateCreated).valueOf() - timeWindowMs;
            const activityColor =
              activity.value === `${IncidentStatus.CRITICAL}`
                ? theme.red300
                : theme.yellow300;
            if (activityColor !== currColor) {
              series.push(createIncidentSeries(activityColor, dateCreated));
              currColor = activityColor;
            }
            series.push(
              createStatusAreaSeries(
                activityColor,
                dateCreated,
                idx === statusChanges.length - 1
                  ? moment(incidentEnd).valueOf()
                  : moment(statusChanges[idx + 1].dateCreated).valueOf() - timeWindowMs
              )
            );
          });
        });
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
