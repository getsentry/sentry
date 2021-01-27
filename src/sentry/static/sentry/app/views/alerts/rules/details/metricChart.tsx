import React from 'react';
import moment from 'moment';

import MarkLine from 'app/components/charts/components/markLine';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import {Series} from 'app/types/echarts';
import theme from 'app/utils/theme';

import {Incident} from '../../types';

type Props = {
  data: Series[];
  incidents?: Incident[];
};

const MetricChart = ({data, incidents}: Props) => {
  // Iterate through incidents to add markers to chart
  let incidentLines;
  let criticalAreas;
  const dataArr = data[0].data;
  const firstPoint = dataArr[0].name;
  const lastPoint = dataArr[dataArr.length - 1].name;
  const resolvedArea = {
    seriesName: 'Critical Area',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: theme.green300, type: 'solid', width: 4},
      data: [[{coord: [firstPoint, 0]}, {coord: [lastPoint, 0]}] as any],
    }),
    data: [],
  };
  if (incidents) {
    criticalAreas = incidents.map(incident => {
      const detectTime = moment(incident.dateDetected).valueOf();
      let resolveTime;
      if (incident.dateClosed) {
        resolveTime = moment(incident.dateClosed).valueOf();
      } else {
        resolveTime = lastPoint;
      }
      const line = [{coord: [detectTime, 0]}, {coord: [resolveTime, 0]}];
      return {
        seriesName: 'Critical Area',
        type: 'line',
        markLine: MarkLine({
          silent: true,
          lineStyle: {color: theme.red300, type: 'solid', width: 4},
          data: [line as any],
        }),
        data: [],
      };
    });
    incidentLines = incidents.map(incident => {
      const detectTime = moment(incident.dateDetected).valueOf();
      return {
        seriesName: 'Incident Line',
        type: 'line',
        markLine: MarkLine({
          silent: true,
          lineStyle: {color: theme.red300, type: 'solid'},
          data: [
            {
              xAxis: detectTime,
            } as any,
          ],
          label: {
            show: true,
            position: 'insideEndTop',
            formatter: 'CRITICAL',
            color: theme.red300,
            fontSize: 10,
          } as any,
        }),
        data: [],
      };
    });
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
      series={[...data, resolvedArea, ...incidentLines, ...criticalAreas]}
    />
  );
};

export default MetricChart;
