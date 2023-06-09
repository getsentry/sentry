import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {Series} from 'sentry/types/echarts';
import {P95_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {useQueryGetSpanTransactionSamples} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/queries';

type Props = {
  groupId: string;
  transactionName: string;
  spanDescription?: string;
};

function DurationChart({groupId, transactionName}: Props) {
  const theme = useTheme();

  const {isLoading, data: spanMetricsSeriesData} = useSpanMetricsSeries(
    {group: groupId},
    {transactionName},
    ['p95(span.duration)'],
    'sidebar-span-metrics'
  );

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
      symbol: 'path://M -1 -1 V -5 H 0 V -1 H 4 V 0 H 0 V 4 H -1 V 0 H -5 V -1 H -1',
      color: theme.gray400,
      symbolSize: 15,
      seriesName: transaction_id.split('-')[0],
    })
  );

  return (
    <Fragment>
      <h5>{DataTitles.p95}</h5>
      <Chart
        statsPeriod="24h"
        height={140}
        data={[spanMetricsSeriesData?.['p95(span.duration)']]}
        start=""
        end=""
        loading={isLoading}
        scatterPlot={isSamplesLoading ? undefined : sampledSpanDataSeries}
        utc={false}
        chartColors={[P95_COLOR]}
        isLineChart
        definedAxisTicks={4}
      />
    </Fragment>
  );
}

export default DurationChart;
