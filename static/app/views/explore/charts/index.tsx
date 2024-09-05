import {Fragment} from 'react';
import styled from '@emotion/styled';

import {getInterval} from 'sentry/components/charts/utils';
import {CompactSelect} from 'sentry/components/compactSelect';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {tooltipFormatter} from 'sentry/utils/discover/charts';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useChartType} from 'sentry/views/explore/hooks/useChartType';
import {useVisualizes} from 'sentry/views/explore/hooks/useVisualizes';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSpanIndexedSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {CHART_HEIGHT} from 'sentry/views/insights/database/settings';

interface ExploreChartsProps {
  query: string;
}

const exploreChartTypeOptions = [
  {
    value: ChartType.LINE,
    label: t('Line'),
  },
  {
    value: ChartType.AREA,
    label: t('Area'),
  },
  {
    value: ChartType.BAR,
    label: t('Bar'),
  },
];

// TODO: Update to support aggregate mode and multiple queries / visualizations
export function ExploreCharts({query}: ExploreChartsProps) {
  const pageFilters = usePageFilters();
  const [visualizes] = useVisualizes();
  const [chartType, setChartType] = useChartType();
  const [interval, setInterval, intervalOptions] = useChartInterval();

  const series = useSpanIndexedSeries(
    {
      search: new MutableSearch(query ?? ''),
      yAxis: visualizes,
      interval: interval ?? getInterval(pageFilters.selection.datetime, 'metrics'),
      enabled: true,
    },
    'api.explorer.stats'
  );

  return (
    <Fragment>
      {visualizes.map((visualize, index) => (
        <ChartContainer key={index}>
          <ChartPanel>
            <ChartHeader>
              <ChartTitle>{visualize}</ChartTitle>
              <ChartSettingsContainer>
                <CompactSelect
                  size="xs"
                  triggerProps={{prefix: t('Display')}}
                  value={chartType}
                  options={exploreChartTypeOptions}
                  onChange={newChartType => setChartType(newChartType.value)}
                />
                <CompactSelect
                  size="xs"
                  value={interval}
                  onChange={({value}) => setInterval(value)}
                  triggerProps={{
                    prefix: t('Interval'),
                  }}
                  options={intervalOptions}
                />
              </ChartSettingsContainer>
            </ChartHeader>
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
              type={chartType}
              aggregateOutputFormat="number"
              showLegend
              tooltipFormatterOptions={{
                valueFormatter: value => tooltipFormatter(value),
              }}
            />
          </ChartPanel>
        </ChartContainer>
      ))}
    </Fragment>
  );
}

const ChartContainer = styled('div')`
  display: grid;
  gap: 0;
  grid-template-columns: 1fr;
  margin-bottom: ${space(3)};
`;

const ChartHeader = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const ChartTitle = styled('div')`
  ${p => p.theme.text.cardTitle}
`;

const ChartSettingsContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
