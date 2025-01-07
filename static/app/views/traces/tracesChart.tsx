import {useMemo} from 'react';
import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSpanIndexedSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {CHART_HEIGHT} from 'sentry/views/insights/database/settings';

import {areQueriesEmpty} from './utils';

interface Props {}

export function TracesChart({}: Props) {
  const location = useLocation();

  const queries = useMemo(() => {
    return decodeList(location.query.query)?.map(query => query.trim());
  }, [location.query.query]);

  const enabled = useMemo(
    () => [
      true, // always visualize the first series
      Boolean(queries?.[1]),
      Boolean(queries?.[2]),
    ],
    [queries]
  );

  const firstCountSeries = useTraceCountSeries({
    query: queries?.[0] || '',
    enabled: enabled[0]!,
  });
  const secondCountSeries = useTraceCountSeries({
    query: queries?.[1]!,
    enabled: enabled[1]!,
  });
  const thirdCountSeries = useTraceCountSeries({
    query: queries?.[2]!,
    enabled: enabled[2]!,
  });

  const seriesAreLoading =
    // Disabled queries have `isLoading: true`, but this changes in v5.
    // To handle this gracefully, we check if the query is enabled + isLoading.
    //
    // References
    // - https://tanstack.com/query/v4/docs/framework/react/guides/disabling-queries
    // - https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries#isloading-previously-isinitialloading
    (enabled[0]! && firstCountSeries.isPending) ||
    (enabled[1]! && secondCountSeries.isPending) ||
    (enabled[2]! && thirdCountSeries.isPending);

  const error = useMemo(() => {
    const errors = [
      firstCountSeries.error,
      secondCountSeries.error,
      thirdCountSeries.error,
    ];

    for (let i = 0; i < errors.length; i++) {
      if (!enabled[i]) {
        continue;
      }

      if (errors[i]) {
        return errors[i];
      }
    }
    return null;
  }, [enabled, firstCountSeries, secondCountSeries, thirdCountSeries]);

  const chartData = useMemo<Series[]>(() => {
    const series = [firstCountSeries.data, secondCountSeries.data, thirdCountSeries.data];

    const allData: Series[] = [];

    for (let i = 0; i < series.length; i++) {
      if (!enabled[i] || error) {
        continue;
      }
      const data = series[i]!['count()'];
      data.color = CHART_PALETTE[2][i];
      data.seriesName =
        `span ${i + 1}: ${queries[i] || t('All spans')}` || t('All spans');
      allData.push(data);
    }

    return allData;
  }, [
    enabled,
    queries,
    error,
    firstCountSeries.data,
    secondCountSeries.data,
    thirdCountSeries.data,
  ]);

  return (
    <ChartContainer>
      <ChartPanel
        title={areQueriesEmpty(queries) ? t('All Spans') : t('All Matching Spans')}
      >
        <Chart
          height={CHART_HEIGHT}
          grid={{
            left: '0',
            right: '0',
            top: '8px',
            bottom: '0',
          }}
          data={chartData}
          error={error}
          loading={seriesAreLoading}
          chartColors={CHART_PALETTE[2]}
          type={ChartType.LINE}
          aggregateOutputFormat="number"
          showLegend
          tooltipFormatterOptions={{
            valueFormatter: value => tooltipFormatter(value),
          }}
        />
      </ChartPanel>
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  display: grid;
  gap: 0;
  grid-template-columns: 1fr;
`;

const useTraceCountSeries = ({
  enabled,
  query,
}: {
  enabled: boolean;
  query: string | null;
}) => {
  const pageFilters = usePageFilters();

  return useSpanIndexedSeries(
    {
      search: new MutableSearch(query ?? ''),
      yAxis: ['count()'],
      interval: getInterval(pageFilters.selection.datetime, 'metrics'),
      overriddenRoute: 'traces-stats',
      enabled,
    },
    'api.trace-explorer.stats'
  );
};
