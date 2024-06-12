import {useMemo} from 'react';
import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {RateUnit} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useSpanIndexedSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';

import {areQueriesEmpty} from './utils';

interface Props {}

export function TracesChart({}: Props) {
  const location = useLocation();

  const queries = useMemo(() => {
    return decodeList(location.query.query);
  }, [location.query.query]);

  const firstCountSeries = useTraceCountSeries(queries[0] ?? ''); // Always provide query string to visualize at least some spans when landing on the page.
  const secondCountSeries = useTraceCountSeries(queries[1]);
  const thirdCountSeries = useTraceCountSeries(queries[2]);

  const seriesAreLoading =
    firstCountSeries.isLoading ||
    secondCountSeries.isLoading ||
    thirdCountSeries.isLoading;

  const chartData = useMemo<Series[]>(() => {
    const data: Series[] = [];
    const firstQueryData = firstCountSeries.data['count()'];
    const secondQueryData = secondCountSeries.data['count()'];
    const thirdQueryData = thirdCountSeries.data['count()'];

    firstQueryData.color = CHART_PALETTE[2][0];
    secondQueryData.color = CHART_PALETTE[2][1];
    thirdQueryData.color = CHART_PALETTE[2][2];

    firstQueryData.seriesName = queries[0] || t('All spans');
    secondQueryData.seriesName = queries[1];
    thirdQueryData.seriesName = queries[2];

    data.push(firstQueryData);

    if (queries[1]) {
      data.push(secondQueryData);
    }
    if (queries[2]) {
      data.push(thirdQueryData);
    }
    return data;
  }, [queries, firstCountSeries.data, secondCountSeries.data, thirdCountSeries.data]);

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
          loading={seriesAreLoading}
          chartColors={CHART_PALETTE[2]}
          type={ChartType.LINE}
          aggregateOutputFormat="number"
          showLegend
          tooltipFormatterOptions={{
            valueFormatter: value => formatRate(value, RateUnit.PER_MINUTE),
          }}
          preserveIncompletePoints
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

const useTraceCountSeries = (query: string | null) => {
  const pageFilters = usePageFilters();

  return useSpanIndexedSeries(
    {
      search: new MutableSearch(query ?? ''),
      yAxis: ['count()'],
      interval: getInterval(pageFilters.selection.datetime, 'metrics'),
      overriddenRoute: 'traces-stats',
      enabled: query !== null && query !== undefined,
    },
    'api.trace-explorer.stats'
  );
};
