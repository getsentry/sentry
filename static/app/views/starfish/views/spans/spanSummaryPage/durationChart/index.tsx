import {useTheme} from '@emotion/react';
import moment from 'moment';

import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {
  useQueryGetSpanSeriesData,
  useQuerySpansInTransaction,
} from 'sentry/views/starfish/views/spanSummary/queries';
import {queryDataToChartData} from 'sentry/views/starfish/views/spanSummary/sidebar';

type Props = {
  groupId: string;
  transactionName: string;
  spanDescription?: string;
};

function DurationChart({groupId, transactionName, spanDescription}: Props) {
  const theme = useTheme();
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

  const {p50: p50Series} = queryDataToChartData(seriesData, startTime, endTime, {
    lineStyle: {type: 'dotted'},
  });

  return (
    <Chart
      statsPeriod="24h"
      height={140}
      data={[p50Series ?? []]}
      start=""
      end=""
      loading={isLoading || isLoadingSeriesData}
      utc={false}
      chartColors={theme.charts.getColorPalette(4).slice(5, 6)}
      stacked
      isLineChart
      disableXAxis
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
