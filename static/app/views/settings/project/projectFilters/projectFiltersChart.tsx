import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import startCase from 'lodash/startCase';

import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {UsageSeries} from 'sentry/views/organizationStats/types';

type Props = {
  project: Project;
};

function formatData(rawData: UsageSeries | undefined, theme: Theme) {
  if (!rawData?.groups?.length) {
    return [];
  }

  const fallbackColor = theme.colors.gray200;
  const statOpsColors = theme.chart.getColorPalette(rawData.groups.length);

  const formattedData = rawData.groups.map((group, index) => {
    const reason = String(group.by.reason!);
    return {
      seriesName: startCase(reason),
      color: statOpsColors[index] ?? fallbackColor,
      data: rawData.intervals.map((interval, i) => ({
        name: interval,
        value: group.series['sum(quantity)']![i]!,
      })),
    };
  });

  return formattedData;
}

export function ProjectFiltersChart({project}: Props) {
  const organization = useOrganization();
  const theme = useTheme();

  const {data, isError, isPending, refetch} = useApiQuery<UsageSeries>(
    [
      `/organizations/${organization.slug}/stats_v2/`,
      {
        query: {
          project: project.id,
          category: ['transaction', 'default', 'security', 'error'],
          outcome: 'filtered',
          field: 'sum(quantity)',
          groupBy: 'reason',
          interval: '1d',
          statsPeriod: '30d',
        },
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  const formattedData = formatData(data, theme);
  const hasLoaded = !isPending && !isError;
  const colors = formattedData.map(series => series.color);
  const blankStats = !formattedData.length;

  return (
    <Panel>
      <PanelHeader>{t('Events filtered in the last 30 days (by day)')}</PanelHeader>

      <PanelBody withPadding>
        {isPending && <Placeholder height="100px" />}
        {isError && <LoadingError onRetry={refetch} />}
        {hasLoaded && !blankStats && (
          <MiniBarChart
            series={formattedData}
            colors={colors}
            height={100}
            isGroupedByDate
            stacked
            labelYAxisExtents
            hideZeros
            showXAxisLine
          />
        )}
        {hasLoaded && blankStats && (
          <EmptyMessage title={t('Nothing filtered in the last 30 days.')}>
            {t('Issues filtered as a result of your settings below will be shown here.')}
          </EmptyMessage>
        )}
      </PanelBody>
    </Panel>
  );
}
