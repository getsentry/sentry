import React from 'react';
import moment from 'moment';

import {t} from 'app/locale';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import {Trigger} from 'app/views/settings/incidentRules/types';
import LineChart from 'app/components/charts/lineChart';
import MarkPoint from 'app/components/charts/components/markPoint';
import MarkLine from 'app/components/charts/components/markLine';
import VisualMap from 'app/components/charts/components/visualMap';

import closedSymbol from './closedSymbol';
import detectedSymbol from './detectedSymbol';

type Data = [number, {count: number}[]];
type PiecesObject = {
  min?: number;
  max?: number;
  label?: string;
  value?: number;
  color?: string;
};

/**
 * So we'll have to see how this looks with real data, but echarts requires
 * an explicit (x,y) value to draw a symbol (incident detected/closed bubble).
 *
 * This uses the closest date *without* going over.
 *
 * AFAICT we can't give it an x-axis value and have it draw on the line,
 * so we probably need to calculate the y-axis value ourselves if we want it placed
 * at the exact time.
 *
 * @param data Data array
 * @param needle the target timestamp
 */
function getNearbyIndex(data: Data[], needle: number) {
  // `data` is sorted, return the first index whose value (timestamp) is > `needle`
  const index = data.findIndex(([ts]) => ts > needle);

  // this shouldn't happen, as we try to buffer dates before start/end dates
  if (index === 0) {
    return 0;
  }

  return index !== -1 ? index - 1 : data.length - 1;
}

/**
 * We can't just pass an x value to the charts, so we calculate a y value
 * between points using the average of the two points it's between.
 *
 * @param data Data array
 * @param index The (lower) index of the two points used to calculate the average
 */
function getAverageBetweenPoints(data: Data[], index: number) {
  if (index >= data.length - 1) {
    return getDataValue(data[data.length - 1]);
  } else if (index < 0) {
    return getDataValue(data[0]);
  } else {
    const pt1 = getDataValue(data[index]);
    const pt2 = getDataValue(data[index + 1]);
    return (pt1 + pt2) / 2;
  }
}

function getDataValue(data: Data) {
  if (data === undefined || data[1] === undefined) {
    return 0;
  } else {
    return data[1].reduce((acc, {count} = {count: 0}) => acc + count, 0);
  }
}

type Props = {
  data: Data[];
  aggregate: string;
  detected: string;
  closed?: string;
  triggers?: Trigger[];
};

const Chart = (props: Props) => {
  const {aggregate, data, detected, closed, triggers} = props;
  const detectedTs = detected && moment.utc(detected).unix();
  const closedTs = closed && moment.utc(closed).unix();
  const chartData = data.map(([ts, val]) => [
    ts * 1000,
    val.length ? val.reduce((acc, {count} = {count: 0}) => acc + count, 0) : 0,
  ]);

  let detectedCoordinate: number[] | undefined;
  if (detectedTs) {
    const nearbyDetectedTimestampIndex = getNearbyIndex(data, detectedTs);
    const detectedYValue =
      nearbyDetectedTimestampIndex &&
      getAverageBetweenPoints(data, nearbyDetectedTimestampIndex);
    detectedCoordinate = [detectedTs * 1000, detectedYValue];
    chartData.splice(nearbyDetectedTimestampIndex + 1, 0, detectedCoordinate);
  }

  const showClosedMarker =
    data && closedTs && data[data.length - 1] && data[data.length - 1][0] >= closedTs
      ? true
      : false;
  let closedCoordinate: number[] | undefined;
  if (closedTs && showClosedMarker) {
    const nearbyClosedTimestampIndex = getNearbyIndex(data, closedTs);
    const closedYValue =
      nearbyClosedTimestampIndex &&
      getAverageBetweenPoints(data, nearbyClosedTimestampIndex);
    closedCoordinate = [closedTs * 1000, closedYValue];
    chartData.splice(nearbyClosedTimestampIndex + 1, 0, closedCoordinate);
  }

  const seriesName = aggregate;

  const warningTrigger = triggers?.find(trig => trig.label === 'warning');
  const criticalTrigger = triggers?.find(trig => trig.label === 'critical');
  const warningTriggerThreshold =
    warningTrigger &&
    typeof warningTrigger.alertThreshold === 'number' &&
    warningTrigger.alertThreshold;
  const criticalTriggerThreshold =
    criticalTrigger &&
    typeof criticalTrigger.alertThreshold === 'number' &&
    criticalTrigger.alertThreshold;

  const visualMapPieces: PiecesObject[] = [];
  // Echarts throws an error if when the first element in pieces doesn't have both min/max
  if (warningTriggerThreshold ?? criticalTriggerThreshold)
    visualMapPieces.push({
      min: -1, // if this is 0 the x axis goes halfway over the line
      max: (warningTriggerThreshold ?? criticalTriggerThreshold) || 0,
      color: theme.purple500,
    });
  if (warningTriggerThreshold && criticalTriggerThreshold)
    visualMapPieces.push({
      min: warningTriggerThreshold,
      max: criticalTriggerThreshold,
      color: theme.yellow400,
    });
  if (criticalTriggerThreshold)
    visualMapPieces.push({
      min: criticalTriggerThreshold,
      color: theme.red300,
    });

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
      series={[
        {
          // e.g. Events or Users
          seriesName,
          dataArray: chartData,
          markPoint: MarkPoint({
            data: [
              {
                labelForValue: seriesName,
                seriesName,
                symbol: `image://${detectedSymbol}`,
                name: t('Alert Triggered'),
                coord: detectedCoordinate,
              },
              ...(closedTs
                ? [
                    {
                      labelForValue: seriesName,
                      seriesName,
                      symbol: `image://${closedSymbol}`,
                      symbolSize: 24,
                      name: t('Alert Resolved'),
                      coord: closedCoordinate,
                    },
                  ]
                : []),
            ],
          }),
        },
        warningTriggerThreshold && {
          type: 'line',
          markLine: MarkLine({
            silent: true,
            lineStyle: {color: theme.yellow400},
            data: [
              {
                yAxis: warningTriggerThreshold,
              },
            ],
            label: {
              show: false,
            },
          }),
          data: [],
        },
        criticalTriggerThreshold && {
          type: 'line',
          markLine: MarkLine({
            silent: true,
            lineStyle: {color: theme.red300},
            data: [
              {
                yAxis: criticalTriggerThreshold,
              },
            ],
            label: {
              show: false,
            },
          }),
          data: [],
        },
      ].filter(Boolean)}
      options={{
        visualMap: VisualMap({
          pieces: visualMapPieces,
          show: false,
        }),
      }}
    />
  );
};

export default Chart;
