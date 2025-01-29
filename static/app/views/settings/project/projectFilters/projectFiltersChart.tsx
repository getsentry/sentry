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
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import theme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import type {UsageSeries} from 'sentry/views/organizationStats/types';

type Props = {
  project: Project;
};

const STAT_OPS = {
  'browser-extensions': theme.gray200,
  cors: theme.yellow300,
  'error-message': theme.purple300,
  'discarded-hash': theme.gray200,
  'invalid-csp': theme.blue300,
  'ip-address': theme.red200,
  'legacy-browsers': theme.gray200,
  localhost: theme.blue300,
  'release-version': theme.purple200,
  'web-crawlers': theme.red300,
  'filtered-transaction': theme.yellow400,
  'react-hydration-errors': theme.outcome.filtered,
  'chunk-load-error': theme.outcome.filtered,
};

function formatData(rawData: UsageSeries | undefined) {
  if (!rawData || !rawData.groups?.length) {
    return [];
  }

  const formattedData = rawData.groups
    .map(group => {
      const reason = group.by.reason;

      if (!defined(reason)) {
        return undefined;
      }

      return {
        seriesName: startCase(String(reason)),
        color: STAT_OPS[reason as keyof typeof STAT_OPS] ?? theme.gray200,
        data: rawData.intervals
          .map((interval, index) => ({
            name: interval,
            value: group.series['sum(quantity)']![index]!,
          }))
          .filter(dataPoint => !!dataPoint.value),
      };
    })
    .filter(defined);

  return formattedData;
}

export function ProjectFiltersChart({project}: Props) {
  const organization = useOrganization();

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

  const formattedData = formatData(data);
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
          />
        )}
        {hasLoaded && blankStats && (
          <EmptyMessage
            title={t('Nothing filtered in the last 30 days.')}
            description={t(
              'Issues filtered as a result of your settings below will be shown here.'
            )}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

export default ProjectFiltersChart;
