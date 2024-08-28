import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSpanIndexedSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {CHART_HEIGHT} from 'sentry/views/insights/database/settings';

import {useVisualize} from '../hooks/useVisualize';

interface ExploreChartsProps {
  query: string;
}

const useExplorerChartSeries = ({yAxis, query}: {query: string; yAxis: string}) => {
  const pageFilters = usePageFilters();

  return useSpanIndexedSeries(
    {
      search: new MutableSearch(query ?? ''),
      yAxis: [yAxis],
      interval: getInterval(pageFilters.selection.datetime, 'metrics'),
      enabled: true,
    },
    'api.explorer.stats'
  );
};

export function ExploreCharts({query}: ExploreChartsProps) {
  const [visualize] = useVisualize();

  const series = useExplorerChartSeries({
    yAxis: visualize,
    query,
  });

  return (
    <ChartContainer>
      <ChartPanel title={visualize}>
        <Chart
          height={CHART_HEIGHT}
          grid={{
            left: '0',
            right: '0',
            top: '8px',
            bottom: '0',
          }}
          data={[series.data[visualize]]}
          error={series.error}
          loading={series.isPending}
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
  margin-bottom: ${space(4)};
`;
