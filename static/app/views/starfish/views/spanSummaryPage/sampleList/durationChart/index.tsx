import moment from 'moment';

import {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import {P95_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {queryDataToChartData} from 'sentry/views/starfish/utils/queryDataToChartData';
import {
  useQueryGetSpanSeriesData,
  useQuerySpansInTransaction,
} from 'sentry/views/starfish/views/spanSummaryPage/queries';
import {useQueryGetSpanTransactionSamples} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/queries';

type Props = {
  groupId: string;
  transactionName: string;
  spanDescription?: string;
};

function DurationChart({groupId, transactionName, spanDescription}: Props) {
  const pageFilter = usePageFilters();
  const {isLoading, data} = useQuerySpansInTransaction({groupId});

  const spanGroupOperation = data?.[0]?.span_operation;
  const module = data?.[0]?.module;
  const {startTime, endTime} = getStartAndEndTime(pageFilter);

  const {isLoading: isLoadingSeriesData, data: seriesData} = useQueryGetSpanSeriesData({
    groupId,
    spanGroupOperation,
    transactionName,
    description: spanDescription,
    module,
  });

  const {p95: p95Series} = queryDataToChartData(seriesData, startTime, endTime);

  const {data: sampleListData, isLoading: isSamplesLoading} =
    useQueryGetSpanTransactionSamples({
      groupId,
      transactionName,
    });

  const sampledSpanDataSeries: Series[] = sampleListData.map(
    ({timestamp, spanDuration, transaction_id}) => ({
      data: [
        {
          name: timestamp,
          value: spanDuration,
        },
      ],
      seriesName: transaction_id.split('-')[0],
    })
  );

  return (
    <Chart
      statsPeriod="24h"
      height={140}
      data={p95Series ? [p95Series] : []}
      start=""
      end=""
      loading={isLoading || isLoadingSeriesData}
      scatterPlot={isSamplesLoading ? undefined : sampledSpanDataSeries}
      utc={false}
      chartColors={[P95_COLOR]}
      isLineChart
      definedAxisTicks={4}
    />
  );
}

const getStartAndEndTime = pageFilter => {
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);
  return {startTime, endTime};
};

export default DurationChart;
