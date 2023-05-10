import {Duration} from 'moment';

import {Series} from 'sentry/types/echarts';
import {DataRow} from 'sentry/views/starfish/modules/APIModule/endpointTable';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

export default function combineTableDataWithSparklineData(
  tableData: DataRow[],
  aggregateData,
  momentInterval: Duration
): DataRow[] {
  const aggregatesGroupedByQuery = {};
  aggregateData.forEach(({description, interval, count, p75}) => {
    if (description in aggregatesGroupedByQuery) {
      aggregatesGroupedByQuery[description].push({name: interval, count, p75});
    } else {
      aggregatesGroupedByQuery[description] = [{name: interval, count, p75}];
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

    const p75Series: Series = {
      seriesName: 'p75 Trend',
      data: aggregatesGroupedByQuery[query]?.map(({name, p75}) => ({
        name,
        value: p75,
      })),
    };

    const zeroFilledThroughput = zeroFillSeries(throughputSeries, momentInterval);
    const zeroFilledP75 = zeroFillSeries(p75Series, momentInterval);
    return {...data, throughput: zeroFilledThroughput, p75_trend: zeroFilledP75};
  });

  return combinedData;
}
