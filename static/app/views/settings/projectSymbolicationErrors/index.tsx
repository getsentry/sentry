import type {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {Feature} from 'sentry/components/acl/feature';
import {markLine as createMarkLine} from 'sentry/components/charts/components/markLine';
import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {NotFound} from 'sentry/components/errors/notFound';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getPaginationProps} from 'sentry/utils/pagination';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  isEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {FIXES, getSymbolicationErrorInfo, STATS_PERIOD} from './constants';
import {FailureDetails} from './failureDetails';
import {
  causeTimeseriesOptions,
  failureTrendsOptions,
  issueVolumesOptions,
  issueVolumeTrendsOptions,
  OTHER_CAUSES,
  totalEventsTimeseriesOptions,
  symbolicationFailuresOptions,
  trendKey,
  type FailureRow,
  type IssueVolume,
} from './queries';

const CHART_HEIGHT = 260;

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

function useCauseColors(stats: EventsStats | MultiSeriesEventsStats | undefined) {
  const theme = useTheme();
  const series = causeSeries(stats);
  const palette = theme.chart.getColorPalette(Math.max(series.length - 1, 0));
  return new Map(series.map(([cause], index) => [cause, palette[index]!]));
}

function toTimeSeries(
  yAxis: string,
  valueType: TimeSeries['meta']['valueType'],
  values: TimeSeries['values']
): TimeSeries {
  const first = values[0]?.timestamp ?? 0;
  const second = values[1]?.timestamp ?? first;
  return {yAxis, meta: {valueType, valueUnit: null, interval: second - first}, values};
}

function toCausePlottables(
  series: Array<[string, EventsStats]>,
  colors: CauseColors,
  total: EventsStats | undefined,
  totalColor: string
): Plottable[] {
  const failuresByDay = new Map<number, number>();
  const bars = series.map(([cause, data], index) => {
    const points = toPoints(data);
    for (const point of points) {
      failuresByDay.set(
        point.timestamp,
        (failuresByDay.get(point.timestamp) ?? 0) + point.value
      );
    }
    return new Bars(toTimeSeries('count_unique(event_id)', 'number', points), {
      name: `symbolication-errors-${index}`,
      alias:
        cause === OTHER_CAUSES
          ? t('Other Causes')
          : getSymbolicationErrorInfo(cause).label,
      color: colors.get(cause),
      stack: 'all',
    });
  });
  if (!bars.length || !total) {
    return bars;
  }
  const otherEvents = toPoints(total).map(point => ({
    timestamp: point.timestamp,
    value: Math.max(0, point.value - (failuresByDay.get(point.timestamp) ?? 0)),
  }));
  return [
    ...bars,
    new Bars(toTimeSeries('count()', 'number', otherEvents), {
      name: 'symbolication-errors-other',
      alias: t('Other Events'),
      color: totalColor,
      stack: 'all',
    }),
  ];
}

interface ChartProps {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  plottables: Plottable[];
  project: Project;
}

function ChartVisualization({
  project,
  plottables,
  isPending,
  isError,
  onRetry,
}: ChartProps) {
  if (isPending) {
    return <TimeSeriesWidgetVisualization.LoadingPlaceholder />;
  }
  if (isError) {
    return (
      <Widget.WidgetError
        error={t('Unable to load the chart.')}
        action={
          <Button size="xs" onClick={onRetry}>
            {t('Retry')}
          </Button>
        }
      />
    );
  }
  if (!plottablesCanBeVisualized(plottables)) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Text variant="muted">{t('No data in the last 30 days.')}</Text>
      </Flex>
    );
  }
  return (
    <TimeSeriesWidgetVisualization
      plottables={plottables}
      showReleaseAs="none"
      pageFilters={{
        datetime: {period: STATS_PERIOD, start: null, end: null, utc: null},
        environments: [],
        projects: [Number(project.id)],
      }}
    />
  );
}

function ChartWidget({title, ...chart}: ChartProps & {title: string}) {
  return (
    <Widget
      height={CHART_HEIGHT}
      Title={<Widget.WidgetTitle title={title} />}
      Visualization={<ChartVisualization {...chart} />}
    />
  );
}

// A table narrower than this has no room for five columns. It keeps the issue
// and the failures. The cause goes below the issue, and the fix button goes
// below the failures.
const WIDE = '2xl';

// The cells of a narrow table have different heights, so they align at the top.
const CELL_ALIGN = {zero: 'start', [WIDE]: 'center'} as const;

// A table narrower than this has no room for the trend. It shows only the
// failure count.
const WITH_TREND = 'sm';

const COLUMNS: TableColumnConfig[] = [
  {key: 'project', visible: {[WIDE]: true}, width: '48px'},
  {key: 'issue', width: 'minmax(0, 2fr)'},
  {key: 'cause', visible: {[WIDE]: true}, width: 'minmax(0, 1fr)'},
  {
    key: 'failures',
    width: {zero: 'max-content', [WITH_TREND]: `${TREND_WIDTH + 130}px`},
  },
  {key: 'actions', visible: {[WIDE]: true}, width: 'max-content'},
];

function IssueCell({
  row,
  volume,
  narrowTableCause,
}: {
  narrowTableCause: ReactNode;
  row: FailureRow;
  volume: IssueVolume | undefined;
}) {
  const organization = useOrganization();

  return (
    <Stack gap="2xs" width="100%" minWidth="0">
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
      <Container display={{zero: 'block', [WIDE]: 'none'}} paddingTop="xs">
        {narrowTableCause}
      </Container>
    </Stack>
  );
}

function CauseCell({errorType, project}: {errorType: string; project: Project}) {
  const organization = useOrganization();
  const info = getSymbolicationErrorInfo(errorType);
  const fix = info.fix ? FIXES[info.fix] : undefined;

  return (
    <Stack gap="2xs" width="100%">
      {/* The row keeps the label as wide as its text, so the tooltip centers on it. */}
      <Flex>
        <InfoText title={info.description}>{info.label}</InfoText>
      </Flex>
      <Text size="xs" ellipsis>
        {fix ? (
          <Link
            to={`/settings/${organization.slug}/projects/${project.slug}/${fix.page}`}
          >
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
  issueSeries,
  cause,
  color,
  isPending,
}: {
  cause: string;
  color: string;
  isPending: boolean;
  issueSeries: EventsStats | undefined;
  series: EventsStats | undefined;
}) {
  const theme = useTheme();

  if (isPending) {
    return <Placeholder width={`${TREND_WIDTH}px`} height={`${TREND_HEIGHT}px`} />;
  }

  const failures = (series ? toPoints(series) : []).map(point => ({
    name: point.timestamp,
    value: point.value,
  }));
  const issueEvents = (issueSeries ? toPoints(issueSeries) : []).map(point => ({
    name: point.timestamp,
    value: point.value,
  }));
  const peak = Math.max(0, ...failures.map(point => point.value));
  const tallestSeries = issueEvents.length ? issueEvents : failures;
  const tallest = Math.max(0, ...tallestSeries.map(point => point.value));

  // The same dashed peak line as the issue stream sparkline.
  const markLine =
    tallest > 0
      ? createMarkLine({
          silent: true,
          animation: false,
          lineStyle: {
            color: theme.tokens.border.transparent.neutral.moderate,
            type: [4, 3],
            opacity: 0.6,
            cap: 'round',
          },
          data: [{type: 'max'}],
          label: {
            show: true,
            position: 'end',
            opacity: 1,
            color: theme.tokens.content.secondary,
            fontFamily: 'Rubik',
            fontSize: 10,
            formatter: formatAbbreviatedNumber(tallest),
          },
        })
      : undefined;

  const failureSeries = {seriesName: cause, data: failures};
  const grey = theme.tokens.dataviz.semantic.other;

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
        showMarkLineLabel
        markLineLabelSide="right"
        height={TREND_HEIGHT}
        barOpacity={1}
        hideDelay={50}
        tooltip={{appendToBody: true}}
        // The failures draw over the grey bars of all the events of the issue,
        // like the matching events in the issue stream.
        {...(issueEvents.length
          ? {
              colors: [grey, color],
              emphasisColors: [grey],
              series: [
                {seriesName: t('Total Events'), data: issueEvents, markLine},
                failureSeries,
              ],
            }
          : {colors: [color], series: [{...failureSeries, markLine}]})}
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
  const organization = useOrganization();
  const {data, isPending, isError, refetch} = useQuery({
    ...symbolicationFailuresOptions({organization, project, cursor}),
    select: selectJsonWithHeaders,
    placeholderData: keepPreviousData,
  });
  const rows = data?.json.data ?? [];
  const groupIds = [...new Set(rows.map(row => String(row.group_id)))];
  const volumes = useQuery(issueVolumesOptions({organization, project, groupIds}));
  const trends = useQuery(failureTrendsOptions({organization, project, rows}));
  const {openDrawer} = useDrawer();
  const volumeTrends = useQuery(
    issueVolumeTrendsOptions({organization, project, groupIds})
  );

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
    <Stack gap="md" containerType="inline-size">
      <SimpleTable
        columns={COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell />
            <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Cause')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>
              <Text display={{zero: 'none', [WITH_TREND]: 'inline'}}>
                {t('Failed to symbolicate')}
              </Text>
              <Text display={{zero: 'inline', [WITH_TREND]: 'none'}}>{t('Failed')}</Text>
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell />
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
            const cause = <CauseCell errorType={row.error_type} project={project} />;
            const fixButton = (
              <Button
                size="xs"
                onClick={() =>
                  openDrawer(
                    () => (
                      <FailureDetails
                        organization={organization}
                        project={project}
                        row={row}
                      />
                    ),
                    {
                      ariaLabel: t('Symbolication failure details'),
                      drawerKey: 'symbolication-failure-details',
                    }
                  )
                }
              >
                {t('How to fix')}
              </Button>
            );
            return (
              <SimpleTable.Row key={trendKey(row)}>
                <SimpleTable.RowCell>
                  <ProjectAvatar project={project} title={project.slug} hasTooltip />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell align={CELL_ALIGN}>
                  <IssueCell row={row} volume={volume} narrowTableCause={cause} />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>{cause}</SimpleTable.RowCell>
                <SimpleTable.RowCell align={CELL_ALIGN}>
                  <Stack gap="md" align="end">
                    <Flex gap="md" align="center">
                      <Container display={{zero: 'none', [WITH_TREND]: 'block'}}>
                        <FailureTrend
                          series={trends.data?.[trendKey(row)]}
                          issueSeries={
                            volume ? volumeTrends.data?.[volume.issue] : undefined
                          }
                          cause={getSymbolicationErrorInfo(row.error_type).label}
                          color={
                            causeColors.get(row.error_type) ??
                            causeColors.get(OTHER_CAUSES) ??
                            theme.tokens.dataviz.semantic.accent
                          }
                          isPending={trends.isPending}
                        />
                      </Container>
                      <Text tabular wrap="nowrap">
                        {formatAbbreviatedNumber(row['count_unique(event_id)'])}
                        {volume
                          ? ` / ${formatAbbreviatedNumber(volume['count()'])}`
                          : null}
                      </Text>
                    </Flex>
                    <Container display={{zero: 'block', [WIDE]: 'none'}}>
                      {fixButton}
                    </Container>
                  </Stack>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>{fixButton}</SimpleTable.RowCell>
              </SimpleTable.Row>
            );
          })}
      </SimpleTable>
      <Pagination {...getPaginationProps(data?.headers.Link)} />
    </Stack>
  );
}

function SymbolicationErrors() {
  const {project} = useProjectSettingsOutlet();
  const organization = useOrganization();
  const theme = useTheme();
  const [cursor] = useQueryState('cursor', parseAsString);
  const timeseries = useQuery(causeTimeseriesOptions({organization, project}));
  const causeColors = useCauseColors(timeseries.data);
  const totalEvents = useQuery(totalEventsTimeseriesOptions({organization, project}));

  return (
    <SentryDocumentTitle title={t('Symbolication Errors')} projectSlug={project.slug}>
      <SettingsPageHeader
        title={t('Symbolication Errors')}
        subtitle={t(
          'Issues whose events did not fully symbolicate in the last 30 days. Find the missing upload here, then reprocess the affected issues.'
        )}
      />
      <Stack gap="xl">
        <ChartWidget
          title={t('Symbolication failures by cause')}
          project={project}
          plottables={toCausePlottables(
            causeSeries(timeseries.data),
            causeColors,
            totalEvents.data,
            theme.tokens.dataviz.semantic.other
          )}
          isPending={timeseries.isPending}
          isError={timeseries.isError}
          onRetry={timeseries.refetch}
        />
        <FailuresTable
          project={project}
          cursor={cursor ?? undefined}
          causeColors={causeColors}
        />
      </Stack>
    </SentryDocumentTitle>
  );
}

export default function ProjectSymbolicationErrors() {
  return (
    <Feature features="symbolication-errors-page" renderDisabled={() => <NotFound />}>
      <SymbolicationErrors />
    </Feature>
  );
}
