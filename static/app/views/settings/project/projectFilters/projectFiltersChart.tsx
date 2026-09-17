import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import startCase from 'lodash/startCase';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {Outcome} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getReasonGroupName} from 'sentry/views/organizationStats/getReasonGroupName';
import type {UsageSeries} from 'sentry/views/organizationStats/types';

type Props = {
  project: Project;
};

function formatData(rawData: UsageSeries | undefined, theme: Theme) {
  if (!rawData?.groups?.length) {
    return [];
  }

  // A custom inbound filter reports under a reason of its own, and drops data in
  // every category it applies to. This chart shows what each kind of filter dropped,
  // so all the groups that share a name are summed into one series.
  const valuesByName = new Map<string, number[]>();

  for (const group of rawData.groups) {
    const name = getReasonGroupName(Outcome.FILTERED, String(group.by.reason ?? ''));
    const values = group.series['sum(quantity)'] ?? [];
    const summed = valuesByName.get(name);

    if (summed) {
      values.forEach((value, i) => {
        summed[i] = (summed[i] ?? 0) + value;
      });
    } else {
      valuesByName.set(name, [...values]);
    }
  }

  const fallbackColor = theme.colors.gray200;
  const statOpsColors = theme.chart.getColorPalette(valuesByName.size);

  return Array.from(valuesByName, ([name, values], index) => ({
    seriesName: startCase(name),
    color: statOpsColors[index] ?? fallbackColor,
    data: rawData.intervals.map((interval, i) => ({
      name: interval,
      value: values[i] ?? 0,
    })),
  }));
}

export function ProjectFiltersChart({project}: Props) {
  const organization = useOrganization();
  const theme = useTheme();

  const {data, isError, isPending, refetch} = useApiQuery<UsageSeries>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/stats_v2/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          project: project.id,
          // A custom inbound filter drops logs and trace metrics as well, so those
          // categories count towards what the filters below dropped.
          category: [
            'transaction',
            'default',
            'security',
            'error',
            'log_item',
            'trace_metric',
          ],
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
