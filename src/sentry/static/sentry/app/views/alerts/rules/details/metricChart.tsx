import React from 'react';
import moment from 'moment';

import MarkLine from 'app/components/charts/components/markLine';
import LineChart, {LineChartSeries} from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import {Series} from 'app/types/echarts';
import theme from 'app/utils/theme';
import {Trigger} from 'app/views/settings/incidentRules/types';

import {Incident} from '../../types';

type Props = {
  data: Series[];
  incidents?: Incident[];
  warningTrigger?: Trigger;
  criticalTrigger?: Trigger;
};

function createThresholdSeries(color: string, threshold: number): LineChartSeries {
  const criticalThresholdLine = {
    seriesName: 'Threshold Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color, type: 'dashed', width: 1},
      data: [{yAxis: threshold} as any],
    }),
    data: [],
  };
  return criticalThresholdLine;
}

const MetricChart = ({data, incidents, warningTrigger, criticalTrigger}: Props) => {
  // Iterate through incidents to add markers to chart
  const series: LineChartSeries[] = [...data];
  const dataArr = data[0].data;
  const maxSeriesValue = dataArr.reduce(
    (currMax, coord2) => Math.max(currMax, coord2.value),
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
      const line = [{coord: [detectTime, 0]}, {coord: [resolveTime, 0]}];
      return line;
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
    const incidentLines = filteredIncidents.map(({dateStarted, id}) => {
      const incidentStart = moment(dateStarted).valueOf();
      incidentValueMap[incidentStart] = id;
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
    series.unshift(incidentLinesSeries);
  }

  let maxThresholdValue = 0;
  if (warningTrigger?.alertThreshold) {
    const {alertThreshold} = warningTrigger;
    const warningThresholdLine = createThresholdSeries(theme.yellow300, alertThreshold);
    series.unshift(warningThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
  }

  if (criticalTrigger?.alertThreshold) {
    const {alertThreshold} = criticalTrigger;
    const criticalThresholdLine = createThresholdSeries(theme.red300, alertThreshold);
    series.unshift(criticalThresholdLine);
    maxThresholdValue = Math.max(maxThresholdValue, alertThreshold);
  }

  return (
    <LineChart
      isGroupedByDate
      showTimeInTooltip
      grid={{
        left: 0,
        right: 0,
        top: space(2),
        bottom: 0,
      }}
      yAxis={maxThresholdValue > maxSeriesValue ? {max: maxThresholdValue} : undefined}
      series={series}
    />
  );
};

export default MetricChart;
