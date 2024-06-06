import {useMemo} from 'react';
import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {RateUnit} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {CHART_HEIGHT} from 'sentry/views/performance/database/settings';
import {COUNT_COLOR} from 'sentry/views/starfish/colors';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useSpanIndexedSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';

import {areQueriesEmpty} from './utils';

interface Props {}

export function TracesChart({}: Props) {
  const location = useLocation();
  const pageFilters = usePageFilters();

  const queries = useMemo(() => {
    return decodeList(location.query.query);
  }, [location.query.query]);

  const spanIndexedCountSeries = useSpanIndexedSeries(
    {
      search: new MutableSearch(
        queries
          .filter(Boolean)
          .map(q => `(${q})`)
          .join(' OR ')
      ),
      yAxis: ['count()'],
      interval: getInterval(pageFilters.selection.datetime, 'metrics'),
    },
    'testing.test'
  );

  const seriesData = spanIndexedCountSeries.data?.['count()'];

  return (
    <ChartContainer>
      <ChartPanel
        title={areQueriesEmpty(queries) ? t('Total Spans') : t('Matching Spans')}
      >
        <Chart
          height={CHART_HEIGHT}
          grid={{
            left: '0',
            right: '0',
            top: '8px',
            bottom: '0',
          }}
          data={[seriesData]}
          loading={spanIndexedCountSeries.isLoading}
          chartColors={[COUNT_COLOR]}
          type={ChartType.AREA}
          aggregateOutputFormat="number"
          tooltipFormatterOptions={{
            valueFormatter: value => formatRate(value, RateUnit.PER_MINUTE),
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
