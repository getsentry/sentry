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
import theme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import type {UsageSeries} from 'sentry/views/organizationStats/types';

type Props = {
  project: Project;
};

function formatData(rawData: UsageSeries | undefined) {
  if (!rawData || !rawData.groups?.length) {
    return [];
  }

  const formattedData = rawData.groups
    .filter(group => STAT_OPS[group.by.reason as keyof typeof STAT_OPS])
    .map(group => {
      const {title, color} = STAT_OPS[group.by.reason as keyof typeof STAT_OPS];
      return {
        seriesName: title,
        color,
        data: rawData.intervals
          .map((interval, index) => ({
            name: interval,
            value: group.series['sum(quantity)']![index]!,
          }))
          .filter(dataPoint => !!dataPoint.value),
      };
    });

  return formattedData;
}
const STAT_OPS = {
  'browser-extensions': {title: t('Browser Extension'), color: theme.gray200},
  cors: {title: 'CORS', color: theme.yellow300},
  'error-message': {title: t('Error Message'), color: theme.purple300},
  'discarded-hash': {title: t('Discarded Issue'), color: theme.gray200},
  'invalid-csp': {title: t('Invalid CSP'), color: theme.blue300},
  'ip-address': {title: t('IP Address'), color: theme.red200},
  'legacy-browsers': {title: t('Legacy Browser'), color: theme.gray200},
  localhost: {title: t('Localhost'), color: theme.blue300},
  'release-version': {title: t('Release'), color: theme.purple200},
  'web-crawlers': {title: t('Web Crawler'), color: theme.red300},
  'filtered-transaction': {title: t('Health Check'), color: theme.yellow400},
  'react-hydration-errors': {title: t('Hydration Errors'), color: theme.outcome.filtered},
  'chunk-load-error': {title: t('Chunk Load Errors'), color: theme.outcome.filtered},
};

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
  const colors = formattedData.map(series => series.color || theme.gray200);
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
