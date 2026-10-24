import {useTheme} from '@emotion/react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  isEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {FIXES, getSymbolicationErrorInfo, STATS_PERIOD} from './constants';
import {
  trendKey,
  useCauseTimeseries,
  useFailureTrends,
  useIssueVolumes,
  useSymbolicationFailures,
  type FailureRow,
  type IssueVolume,
} from './queries';

const CHART_HEIGHT = '220px';

// Size of the per-row trend. Every row keeps this box, so the rows line up.
const TREND_HEIGHT = 36;
const TREND_WIDTH = 160;

type CauseColors = Map<string, string>;

function toPoints(series: EventsStats) {
  return series.data.map(([timestamp, counts]) => ({
    timestamp: timestamp * 1000,
    value: counts.reduce((sum, item) => sum + (item.count ?? 0), 0),
  }));
}

/** The chart series in legend order, one per cause. */
function causeSeries(stats: EventsStats | MultiSeriesEventsStats | undefined) {
  if (!stats) {
    return [];
  }
  if (isEventsStats(stats)) {
    return [[t('Events'), stats]] as Array<[string, EventsStats]>;
  }
  if (!isMultiSeriesEventsStats(stats)) {
    return [];
  }
  return Object.entries(stats)
    .filter(([key]) => key !== 'order')
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0));
}

/** The colour of each cause in the chart, so the row trends match it. */
function useCauseColors(stats: EventsStats | MultiSeriesEventsStats | undefined) {
  const theme = useTheme();
  const series = causeSeries(stats);
  const palette = theme.chart.getColorPalette(Math.max(series.length - 1, 0));
  return new Map(series.map(([cause], index) => [cause, palette[index]!]));
}

function toPlottables(
  series: Array<[string, EventsStats]>,
  colors: CauseColors
): Plottable[] {
  return series.map(([cause, data], index) => {
    const values = toPoints(data);
    const first = values[0]?.timestamp ?? 0;
    const second = values[1]?.timestamp ?? first;
    const timeSeries: TimeSeries = {
      yAxis: 'count_unique(event_id)',
      meta: {valueType: 'number', valueUnit: null, interval: second - first},
      values,
    };
    return new Bars(timeSeries, {
      name: `symbolication-errors-${index}`,
      alias: getSymbolicationErrorInfo(cause).label,
      color: colors.get(cause),
      stack: 'all',
    });
  });
}

function CauseChart({
  project,
  stats,
  colors,
  isPending,
  isError,
}: {
  colors: CauseColors;
  isError: boolean;
  isPending: boolean;
  project: Project;
  stats: EventsStats | MultiSeriesEventsStats | undefined;
}) {
  if (isPending) {
    return <Placeholder height={CHART_HEIGHT} />;
  }
  if (isError) {
    return <LoadingError message={t('Unable to load the chart.')} />;
  }

  const plottables = toPlottables(causeSeries(stats), colors);
  if (!plottablesCanBeVisualized(plottables)) {
    return null;
  }

  return (
    <Container height={CHART_HEIGHT} border="primary" radius="md" padding="md">
      <TimeSeriesWidgetVisualization
        plottables={plottables}
        showReleaseAs="none"
        pageFilters={{
          datetime: {period: STATS_PERIOD, start: null, end: null, utc: null},
          environments: [],
          projects: [Number(project.id)],
        }}
      />
    </Container>
  );
}

const COLUMNS: TableColumnConfig[] = [
  {key: 'project', width: '48px'},
  {key: 'issue', width: 'minmax(0, 2fr)'},
  {key: 'cause', width: 'minmax(0, 1fr)'},
  {key: 'issueVolume', width: '110px'},
  {key: 'failures', width: `${TREND_WIDTH + 90}px`},
];

function ProjectCell({projectId}: {projectId: string}) {
  const {projects} = useProjects();
  const project = projects.find(item => item.id === projectId);

  if (!project) {
    return <Text variant="muted">{projectId}</Text>;
  }
  return <ProjectAvatar project={project} title={project.slug} hasTooltip />;
}

function IssueCell({row, volume}: {row: FailureRow; volume: IssueVolume | undefined}) {
  const organization = useOrganization();

  return (
    <Stack gap="2xs" width="100%">
      <Text ellipsis>
        <Link
          to={normalizeUrl(`/organizations/${organization.slug}/issues/${row.group_id}/`)}
        >
          {row.title}
        </Link>
      </Text>
      <Text size="xs" variant="muted" ellipsis>
        {volume?.issue ?? String(row.group_id)}
      </Text>
    </Stack>
  );
}

function CauseCell({errorType, projectId}: {errorType: string; projectId: string}) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const info = getSymbolicationErrorInfo(errorType);
  const projectSlug = projects.find(item => item.id === projectId)?.slug;
  const fix = info.fix ? FIXES[info.fix] : undefined;

  return (
    <Stack gap="2xs" width="100%">
      <InfoText title={info.description}>{info.label}</InfoText>
      <Text size="xs" ellipsis>
        {fix && projectSlug ? (
          <Link to={`/settings/${organization.slug}/projects/${projectSlug}/${fix.page}`}>
            {fix.label}
          </Link>
        ) : (
          <ExternalLink href={info.docsUrl}>{t('Troubleshooting docs')}</ExternalLink>
        )}
      </Text>
    </Stack>
  );
}

function FailureTrend({
  series,
  color,
  isPending,
}: {
  color: string;
  isPending: boolean;
  series: EventsStats | undefined;
}) {
  if (isPending) {
    return <Placeholder width={`${TREND_WIDTH}px`} height={`${TREND_HEIGHT}px`} />;
  }

  const data = (series ? toPoints(series) : []).map(point => ({
    name: point.timestamp,
    value: point.value,
  }));
  const peak = Math.max(0, ...data.map(point => point.value));

  return (
    <Container
      width={`${TREND_WIDTH}px`}
      height={`${TREND_HEIGHT}px`}
      role="img"
      aria-label={t(
        'Symbolication failure trend, peak %s',
        formatAbbreviatedNumber(peak)
      )}
    >
      <MiniBarChart
        animateBars
        showXAxisLine
        hideZeros
        isGroupedByDate
        showTimeInTooltip
        height={TREND_HEIGHT}
        barOpacity={1}
        hideDelay={50}
        colors={[color]}
        tooltip={{appendToBody: true}}
        series={[{seriesName: t('Symbolication failures'), data}]}
      />
    </Container>
  );
}

function FailuresTable({
  project,
  cursor,
  causeColors,
}: {
  causeColors: CauseColors;
  cursor: string | undefined;
  project: Project;
}) {
  const theme = useTheme();
  const {data, isPending, isError, refetch} = useSymbolicationFailures({
    project,
    cursor,
  });
  const rows = data?.json.data ?? [];
  const groupIds = [...new Set(rows.map(row => String(row.group_id)))];
  const volumes = useIssueVolumes({project, groupIds});
  const trends = useFailureTrends({project, rows});

  const volumeByGroup = new Map(
    (volumes.data?.data ?? []).map(volume => [String(volume['issue.id']), volume])
  );

  if (isError) {
    return (
      <LoadingError
        onRetry={refetch}
        message={t('Unable to load symbolication errors.')}
      />
    );
  }

  return (
    <Stack gap="md">
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell />
            <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Cause')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Events')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Failed to symbolicate')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isPending && <SimpleTable.Loading />}
        {!isPending && rows.length === 0 && (
          <SimpleTable.Empty>
            {t('Every event in the last 30 days symbolicated without errors.')}
          </SimpleTable.Empty>
        )}
        {!isPending &&
          rows.map(row => {
            const volume = volumeByGroup.get(String(row.group_id));
            return (
              <SimpleTable.Row key={trendKey(row)}>
                <SimpleTable.RowCell>
                  <ProjectCell projectId={String(row['project.id'])} />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <IssueCell row={row} volume={volume} />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <CauseCell
                    errorType={row.error_type}
                    projectId={String(row['project.id'])}
                  />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  {volumes.isPending ? (
                    <Placeholder width="48px" height="20px" />
                  ) : (
                    <Text tabular>
                      {formatAbbreviatedNumber(volume?.['count()'] ?? 0)}
                    </Text>
                  )}
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Flex gap="md" align="center">
                    <FailureTrend
                      series={trends.data?.[trendKey(row)]}
                      color={
                        causeColors.get(row.error_type) ??
                        theme.tokens.graphics.neutral.moderate
                      }
                      isPending={trends.isPending}
                    />
                    <Text tabular>
                      {formatAbbreviatedNumber(row['count_unique(event_id)'])}
                    </Text>
                  </Flex>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            );
          })}
      </SimpleTable>
      <Pagination pageLinks={data?.headers.Link} />
    </Stack>
  );
}

export default function ProjectSymbolicationErrors() {
  const {project} = useProjectSettingsOutlet();
  const organization = useOrganization();
  const location = useLocation();
  const cursor = decodeScalar(location.query.cursor);
  const timeseries = useCauseTimeseries({project});
  const causeColors = useCauseColors(timeseries.data);

  if (!organization.features.includes('symbolication-errors-page')) {
    return <NotFound />;
  }

  return (
    <SentryDocumentTitle
      title={routeTitleGen(t('Symbolication Errors'), project.slug, false)}
    >
      <SettingsPageHeader
        title={t('Symbolication Errors')}
        subtitle={t(
          'Issues whose events did not fully symbolicate in the last 30 days. Find the missing upload here, then reprocess the affected issues.'
        )}
      />
      <Stack gap="xl">
        <CauseChart
          project={project}
          stats={timeseries.data}
          colors={causeColors}
          isPending={timeseries.isPending}
          isError={timeseries.isError}
        />
        <FailuresTable project={project} cursor={cursor} causeColors={causeColors} />
      </Stack>
    </SentryDocumentTitle>
  );
}
