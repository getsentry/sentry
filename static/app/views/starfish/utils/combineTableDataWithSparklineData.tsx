import {Duration, Moment} from 'moment';

import {Series} from 'sentry/types/echarts';
import {DataRow} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

export default function combineTableDataWithSparklineData(
  tableData: DataRow[],
  aggregateData,
  momentInterval: Duration,
  startTime?: Moment,
  endTime?: Moment
): DataRow[] {
  const aggregatesGroupedByQuery = {};
  aggregateData.forEach(({description, interval, count, p50, p95}) => {
    if (description in aggregatesGroupedByQuery) {
      aggregatesGroupedByQuery[description].push({name: interval, count, p50, p95});
    } else {
      aggregatesGroupedByQuery[description] = [{name: interval, count, p50, p95}];
    }
  });

  const combinedData = tableData.map(data => {
    const query = data.description;

    const throughputSeries: Series = {
      seriesName: 'throughput',
      data: aggregatesGroupedByQuery[query]?.map(({name, count}) => ({
        name,
        value: count,
      })),
    };

    const p50Series: Series = {
      seriesName: 'p50 Trend',
      data: aggregatesGroupedByQuery[query]?.map(({name, p50}) => ({
        name,
        value: p50,
      })),
    };

    const p95Series: Series = {
      seriesName: 'p95 Trend',
      data: aggregatesGroupedByQuery[query]?.map(({name, p95}) => ({
        name,
        value: p95,
      })),
    };

    const zeroFilledThroughput = zeroFillSeries(
      throughputSeries,
      momentInterval,
      startTime,
      endTime
    );
    const zeroFilledP50 = zeroFillSeries(p50Series, momentInterval, startTime, endTime);
    const zeroFilledP95 = zeroFillSeries(p95Series, momentInterval, startTime, endTime);
    return {
      ...data,
      throughput: zeroFilledThroughput,
      p50_trend: zeroFilledP50,
      p95_trend: zeroFilledP95,
    };
  });

  return combinedData;
}
