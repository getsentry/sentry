import React from 'react';
import moment from 'moment';

import {t} from 'app/locale';
import LineChart from 'app/components/charts/lineChart';
import MarkPoint from 'app/components/charts/components/markPoint';

import closedSymbol from './closedSymbol';
import detectedSymbol from './detectedSymbol';

type Data = [number, {count: number}[]][];

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
function getNearbyIndex(data: Data, needle: number) {
  // `data` is sorted, return the first index whose value (timestamp) is > `needle`
  const index = data.findIndex(([ts]) => ts > needle);

  // this shouldn't happen, as we try to buffer dates before start/end dates
  if (index === 0) {
    return 0;
  }

  return index !== -1 ? index - 1 : data.length - 1;
}

type Props = {
  data: Data;
  detected: string;
  closed?: string;
};

export default class Chart extends React.PureComponent<Props> {
  render() {
    const {data, detected, closed} = this.props;

    const chartData = data.map(([ts, val]) => {
      return [
        ts * 1000,
        val.length ? val.reduce((acc, {count} = {count: 0}) => acc + count, 0) : 0,
      ];
    });

    const detectedTs = detected && moment.utc(detected).unix();
    const closedTs = closed && moment.utc(closed).unix();

    const nearbyDetectedTimestampIndex = detectedTs && getNearbyIndex(data, detectedTs);
    const nearbyClosedTimestampIndex = closedTs && getNearbyIndex(data, closedTs);

    const detectedCoordinate = chartData && chartData[nearbyDetectedTimestampIndex];
    const closedCoordinate =
      chartData &&
      closedTs &&
      typeof nearbyClosedTimestampIndex !== 'undefined' &&
      chartData[nearbyClosedTimestampIndex];

    return (
      <LineChart
        isGroupedByDate
        series={[
          {
            seriesName: t('Events'),
            dataArray: chartData,
            markPoint: MarkPoint({
              data: [
                {
                  symbol: `image://${detectedSymbol}`,
                  name: t('Incident Started'),
                  coord: detectedCoordinate,
                },
                ...(closedTs
                  ? [
                      {
                        symbol: `image://${closedSymbol}`,
                        symbolSize: 24,
                        name: t('Incident Closed'),
                        coord: closedCoordinate,
                      },
                    ]
                  : []),
              ],
            }),
          },
        ]}
      />
    );
  }
}
