import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {Placeholder} from 'sentry/components/placeholder';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {
  IconAdd,
  IconFire,
  IconGraph,
  IconInfo,
  IconList,
  IconSettings,
  IconTerminal,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {
  type MapEdge,
  type MapNode,
  ServiceMap,
  Sparkline,
} from 'sentry/views/insights/awsLambda/charts';
import {
  ChartWidget,
  FilterBar,
  formatCount,
  formatMs,
  formatPct,
  formatUsd,
  functionUrl,
  HealthDot,
  InsightCards,
  Kpi,
  KpiRow,
  lambdaUrl,
  MemoryBar,
  KpiSkeletonRow,
  limitLine,
  LoadingBar,
  MockBadge,
  openCreateMonitor,
  RefreshControl,
  Refreshing,
  UpdatedAgo,
  SectionTitle,
  STAT_LABEL,
  StatusTag,
  useSeriesColors,
  useStatColors,
  windowLabel,
} from 'sentry/views/insights/awsLambda/components';
import {
  FACETS,
  useFilteredFunctions,
  useLambdaWindow,
  useMockQuery,
  useTimeQuery,
  useUrlListState,
  useUrlState,
} from 'sentry/views/insights/awsLambda/hooks';
import {
  ACCOUNT_CONCURRENCY_LIMIT,
  ACCOUNTS,
  ALERT_TEMPLATES,
  allInsights,
  coldStartRate,
  constantSeries,
  dependencies,
  failureRate,
  type GroupBy,
  groupedSeries,
  health,
  HOUR,
  insightsFor,
  invocations,
  FUNCTIONS,
  type Insight,
  type LambdaFunction,
  type MetricKey,
  METRICS,
  metricSeries,
  timeoutShareSeries,
  type TimeWindow,
  type Totals,
  totals,
} from 'sentry/views/insights/awsLambda/mockData';
import {mockActions, useMockStore} from 'sentry/views/insights/awsLambda/mockStore';
import {TopBar} from 'sentry/views/navigation/topBar';

export const AWS_LAMBDA_TITLE = t('AWS Lambda');
const DESCRIPTION = t(
  'Every Lambda function instrumented with Sentry: invocations, failures, cold starts, memory and cost from the Sentry Lambda extension, with traces, issues and logs one click away.'
);

const EXPLORE_METRICS: MetricKey[] = [
  'invocations',
  'errors',
  'timeouts',
  'throttles',
  'p95',
  'p99',
  'coldStarts',
  'initP95',
  'concurrency',
  'memory',
  'cost',
  'postRuntime',
];

type SortKey =
  | 'name'
  | 'invocations'
  | 'failure'
  | 'throttles'
  | 'killed'
  | 'p95'
  | 'cold'
  | 'memory'
  | 'cost';

export default function AwsLambdaOverview() {
  const organization = useOrganization();
  const lambdaWindow = useLambdaWindow();
  const {window, previous, live, now} = lambdaWindow;
  const fns = useFilteredFunctions(window);
  const timeQuery = useTimeQuery();
  const [view, setView] = useUrlState('view');
  const instrumented = ACCOUNTS.reduce((sum, account) => sum + account.instrumented, 0);
  const discovered = ACCOUNTS.reduce((sum, account) => sum + account.discovered, 0);

  const query = useMockQuery(
    ['overview', window.start, window.end, now, fns.map(fn => fn.name).join(',')],
    () => ({
      fns,
      window,
      previous,
      current: totals(fns, window),
      before: totals(fns, previous),
      insights: allInsights(fns, window),
    })
  );
  const snapshot = query.data;

  const page = (
    <Fragment>
      <Layout.Title>
        <Flex align="center" gap="sm">
          {AWS_LAMBDA_TITLE}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/platforms/python/integrations/aws-lambda/"
            title={DESCRIPTION}
          />
          <MockBadge />
        </Flex>
      </Layout.Title>
      <TopBar.Slot name="actions">
        <LinkButton
          size="sm"
          icon={<IconSettings />}
          to={lambdaUrl(organization, 'instrumentation/')}
        >
          {t('Instrumentation · %s of %s functions', instrumented, discovered)}
        </LinkButton>
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
      <Layout.Body>
        <Layout.Main width="full">
          <Stack gap="xl">
            <Stack gap="xs">
              <FilterBar
                refresh={
                  <RefreshControl
                    refresh={lambdaWindow.refresh}
                    setRefresh={lambdaWindow.setRefresh}
                    canRefresh={lambdaWindow.canRefresh}
                  />
                }
              />
              <Flex justify="between" align="center">
                <LoadingBar active={query.isFetching} />
                {snapshot && <UpdatedAgo at={query.dataUpdatedAt} />}
              </Flex>
            </Stack>

            {snapshot ? (
              <Refreshing active={!live && query.isFetching && query.isPlaceholderData}>
                <WidgetSyncContextProvider groupName="aws-lambda-overview">
                  <OverviewBody
                    {...snapshot}
                    organization={organization}
                    timeQuery={timeQuery}
                    view={view}
                    setView={setView}
                  />
                </WidgetSyncContextProvider>
              </Refreshing>
            ) : (
              <OverviewSkeleton />
            )}
          </Stack>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );

  return (
    <SentryDocumentTitle title={AWS_LAMBDA_TITLE} orgSlug={organization.slug}>
      <PageFiltersContainer>{page}</PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

interface Snapshot {
  before: Totals;
  current: Totals;
  fns: LambdaFunction[];
  insights: Insight[];
  previous: TimeWindow;
  window: TimeWindow;
}

function OverviewBody({
  fns,
  window,
  current,
  before,
  insights,
  organization,
  timeQuery,
  view,
  setView,
}: Snapshot & {
  organization: Organization;
  setView: (view: string | undefined) => void;
  timeQuery: Record<string, unknown>;
  view: string | undefined;
}) {
  const series = (metric: MetricKey) =>
    metricSeries(fns, metric, window).values.map(v => v.value);
  const {snoozed} = useMockStore();
  const activeInsights = insights.filter(
    insight => (snoozed[insight.id] ?? 0) <= Date.now()
  );
  const healthCounts = fns.reduce<Record<string, number>>((acc, fn) => {
    const value = health(fn, totals([fn], window));
    return {...acc, [value]: (acc[value] ?? 0) + 1};
  }, {});
  const failed = current.errors + current.timeouts + current.oom;
  const days = (window.end - window.start) / (24 * HOUR);

  return (
    <Stack gap="2xl">
      <KpiRow>
        <Kpi
          label={t('Invocations')}
          value={formatCount(current.invocations)}
          current={current.invocations}
          previous={before.invocations}
          polarity="neutral"
          series={series('invocations')}
          detail={windowLabel(window)}
        />
        <Kpi
          label={t('Failure rate')}
          value={formatPct(failureRate(current), 2)}
          current={failureRate(current)}
          previous={failureRate(before)}
          series={series('errors')}
          variant={failureRate(current) > 0.01 ? 'danger' : undefined}
          detail={t(
            '%s errors · %s timeouts · %s OOM',
            formatCount(current.errors),
            formatCount(current.timeouts),
            formatCount(current.oom)
          )}
        />
        <Kpi
          label={t('Throttles')}
          value={formatCount(current.throttles)}
          current={current.throttles}
          previous={before.throttles}
          series={series('throttles')}
          variant={current.throttles > 0 ? 'warning' : undefined}
          detail={t('%s async events dropped', formatCount(current.asyncDropped))}
        />
        <Kpi
          label={t('Peak concurrency')}
          value={formatCount(current.concurrency)}
          detail={
            <Meter
              ratio={current.concurrency / ACCOUNT_CONCURRENCY_LIMIT}
              label={t('of %s account limit', ACCOUNT_CONCURRENCY_LIMIT)}
            />
          }
        />
        <Kpi
          label={t('Estimated cost')}
          value={formatUsd(current.cost)}
          current={current.cost}
          previous={before.cost}
          series={series('cost')}
          detail={t(
            '≈ %s per month',
            formatUsd((current.cost / Math.max(days, 1 / 24)) * 30)
          )}
        />
      </KpiRow>

      <Stack gap="md">
        <SectionTitle>
          {activeInsights.length
            ? tct('Needs attention ([count])', {count: activeInsights.length})
            : t('Needs attention')}
        </SectionTitle>
        <InsightCards
          insights={insights}
          organization={organization}
          timeQuery={timeQuery}
          limit={4}
          expandFirst={false}
        />
      </Stack>

      <Stack gap="md">
        <SectionTitle
          actions={
            <Flex gap="md" align="center">
              <HealthChips counts={healthCounts} />
              {view !== 'map' && <TableGroupSelect />}
              <SegmentedControl<'table' | 'map'>
                size="xs"
                aria-label={t('View')}
                value={view === 'map' ? 'map' : 'table'}
                onChange={next => setView(next === 'table' ? undefined : next)}
              >
                <SegmentedControl.Item key="table" icon={<IconList />}>
                  {t('Table')}
                </SegmentedControl.Item>
                <SegmentedControl.Item key="map" icon={<IconGraph />}>
                  {t('Map')}
                </SegmentedControl.Item>
              </SegmentedControl>
            </Flex>
          }
        >
          <Flex gap="xs" align="center">
            {tct('Functions ([count])', {count: fns.length})}
            <QuestionTooltip
              size="xs"
              title={t(
                'Click a row to preview it. j / k move, Enter previews, o opens, ⌘-click opens directly.'
              )}
            />
          </Flex>
        </SectionTitle>
        {view === 'map' ? (
          <FunctionsMap fns={fns} window={window} organization={organization} />
        ) : (
          <FunctionsTable
            fns={fns}
            window={window}
            organization={organization}
            timeQuery={timeQuery}
          />
        )}
      </Stack>

      <Stack gap="md">
        <SectionTitle>{t('Trends')}</SectionTitle>
        <Grid columns={{xs: '1fr', lg: '1fr 1fr 1fr'}} gap="md">
          <ExploreChart fns={fns} window={window} />
          <FailuresChart fns={fns} window={window} failed={failed} />
          <TimeoutShareChart fns={fns} window={window} />
        </Grid>
      </Stack>

      <MonitorsSection insights={insights} fns={fns} />
    </Stack>
  );
}

function Meter({ratio, label}: {label: string; ratio: number}) {
  return (
    <Stack gap="xs">
      <MeterTrack>
        <MeterFill
          style={{width: `${Math.min(100, Math.max(1, ratio * 100))}%`}}
          ratio={ratio}
        />
      </MeterTrack>
      <Text size="xs" variant="muted">
        {`${formatPct(ratio, 0)} ${label}`}
      </Text>
    </Stack>
  );
}

const MeterTrack = styled('div')`
  height: 6px;
  border-radius: 3px;
  background: ${p => p.theme.tokens.background.tertiary};
  overflow: hidden;
`;

const MeterFill = styled('div')<{ratio: number}>`
  height: 100%;
  border-radius: 3px;
  background: ${p =>
    p.ratio >= 0.8
      ? p.theme.tokens.graphics.danger.vibrant
      : p.ratio >= 0.6
        ? p.theme.tokens.graphics.warning.vibrant
        : p.theme.tokens.graphics.accent.vibrant};
`;

function FailuresChart({
  fns,
  window,
  failed,
}: {
  failed: number;
  fns: LambdaFunction[];
  window: TimeWindow;
}) {
  const colors = useSeriesColors();
  const worst = fns
    .map(fn => ({
      fn,
      failed:
        totals([fn], window).errors +
        totals([fn], window).timeouts +
        totals([fn], window).oom,
    }))
    .sort((a, b) => b.failed - a.failed)[0];
  return (
    <ChartWidget
      title={t('Failed invocations')}
      source="extension"
      height={220}
      window={window}
      releasesFor={fns}
      description={t(
        'Invocations that ended in an error, a timeout or an out-of-memory kill. Throttled requests never ran and are counted separately.'
      )}
      note={
        worst && failed > 0
          ? t(
              '%s of %s failures are in %s',
              formatPct(worst.failed / failed, 0),
              formatCount(failed),
              worst.fn.name
            )
          : t('No failures in this time range')
      }
      plottables={w => [
        new Bars(metricSeries(fns, 'errors', w), {
          alias: t('errors'),
          stack: 'f',
          color: colors.errors,
        }),
        new Bars(metricSeries(fns, 'timeouts', w), {
          alias: t('timeouts'),
          stack: 'f',
          color: colors.timeouts,
        }),
        new Bars(metricSeries(fns, 'oom', w), {
          alias: t('out of memory'),
          stack: 'f',
          color: colors.oom,
        }),
      ]}
    />
  );
}

/** Emphasis chart: functions running close to their timeout in colour, the rest grey. */
function TimeoutShareChart({fns, window}: {fns: LambdaFunction[]; window: TimeWindow}) {
  const theme = useTheme();
  const colorOf = useEntityColor();
  const peak = (values: TimeSeries['values']) =>
    Math.max(0, ...values.map(v => v.value ?? 0));
  const sharesIn = (w: TimeWindow) =>
    fns
      .map(fn => ({fn, series: timeoutShareSeries(fn, w)}))
      .sort((a, b) => peak(b.series.values) - peak(a.series.values));
  const atRisk = sharesIn(window).filter(share => peak(share.series.values) >= 0.5);
  return (
    <ChartWidget
      title={t('Duration p95 vs timeout')}
      source="spans"
      height={220}
      description={t(
        'Each function’s p95 duration as a share of its configured timeout, so fast and slow functions share one scale. Functions above 50% are highlighted.'
      )}
      note={
        atRisk.length
          ? t(
              '%s reached %s of its timeout',
              atRisk[0]!.fn.name,
              formatPct(peak(atRisk[0]!.series.values), 0)
            )
          : t('Every function stays under half its timeout')
      }
      window={window}
      plottables={w =>
        sharesIn(w).map(
          share =>
            new Line(share.series, {
              alias: share.fn.name,
              color:
                peak(share.series.values) >= 0.5
                  ? colorOf(share.fn.name)
                  : theme.tokens.graphics.neutral.moderate,
            })
        )
      }
    />
  );
}

function OverviewSkeleton() {
  return (
    <Stack gap="2xl">
      <KpiSkeletonRow count={5} />
      <Placeholder height="160px" />
      <Placeholder height="420px" />
    </Stack>
  );
}

const INSIGHT_METRIC: Record<string, string> = {
  timeouts: 'timeouts',
  oom: 'out_of_memory',
  throttles: 'throttles',
  iterator: 'iterator_age',
  errors: 'failure_rate',
};

/** Whether a monitor's condition is currently breached, judged by the page's insights. */
function monitorMatches(monitor: {query: string; scope: string}, insight: Insight) {
  const metric = INSIGHT_METRIC[insight.id.split('-').pop() ?? ''];
  const inScope =
    monitor.scope === t('all functions') ||
    monitor.scope.split(', ').includes(insight.functionName);
  return !!metric && inScope && monitor.query.includes(metric);
}

function MonitorsSection({insights, fns}: {fns: LambdaFunction[]; insights: Insight[]}) {
  const {monitors} = useMockStore();
  const scope =
    fns.length === FUNCTIONS.length
      ? t('all functions')
      : fns.map(fn => fn.name).join(', ');
  const suggestions = ALERT_TEMPLATES.filter(
    template => !monitors.some(monitor => monitor.query === template.query)
  );
  return (
    <Stack gap="md">
      <SectionTitle>
        {monitors.length
          ? tct('Monitors ([count])', {count: monitors.length})
          : t('Monitors')}
      </SectionTitle>
      <MonitorList>
        {monitors.map(monitor => {
          const triggered = insights.some(insight => monitorMatches(monitor, insight));
          return (
            <MonitorRow key={monitor.id}>
              <HealthDot health={triggered ? 'critical' : 'healthy'} />
              <Stack gap="0" minWidth="0">
                <Text size="sm" bold ellipsis>
                  {monitor.name}
                </Text>
                <Text size="xs" variant="muted" ellipsis>
                  {triggered
                    ? t('Triggered · notifying %s', monitor.notify)
                    : t('OK · notifies %s', monitor.notify)}
                </Text>
              </Stack>
              <Button
                size="xs"
                variant="transparent"
                onClick={() => mockActions.deleteMonitor(monitor.id)}
              >
                {t('Delete')}
              </Button>
            </MonitorRow>
          );
        })}
        {suggestions.map(template => (
          <MonitorRow key={template.title}>
            <IconAdd size="xs" variant="muted" />
            <InfoText title={template.query} size="sm" variant="muted" ellipsis>
              {template.title}
            </InfoText>
            <Button
              size="xs"
              onClick={() =>
                openCreateMonitor({name: template.title, query: template.query, scope})
              }
            >
              {t('Create')}
            </Button>
          </MonitorRow>
        ))}
      </MonitorList>
    </Stack>
  );
}

const GROUP_BY_OPTIONS: Array<{label: string; value: GroupBy}> = [
  {value: 'none', label: t('No grouping')},
  {value: 'function', label: t('Function')},
  {value: 'team', label: t('Team')},
  {value: 'trigger', label: t('Trigger')},
  {value: 'runtime', label: t('Runtime')},
];

/** Colour follows the entity: a function keeps its colour whatever is filtered or ranked. */
function useEntityColor() {
  const theme = useTheme();
  const palette = theme.chart.getColorPalette(FUNCTIONS.length - 1);
  return (key: string) => {
    if (key === 'Other') {
      return theme.tokens.graphics.neutral.moderate;
    }
    const index = FUNCTIONS.findIndex(fn => fn.name === key);
    return palette[
      (index === -1
        ? Math.abs([...key].reduce((h, c) => h * 31 + c.charCodeAt(0), 7))
        : index) % palette.length
    ]!;
  };
}

function ExploreChart({fns, window}: {fns: LambdaFunction[]; window: TimeWindow}) {
  const [metricParam, setMetric] = useUrlState('metric');
  const [groupParam, setGroup] = useUrlState('groupBy');
  const colorOf = useEntityColor();
  const metric = (
    EXPLORE_METRICS.includes(metricParam as MetricKey) ? metricParam : 'invocations'
  ) as MetricKey;
  const groupBy = (
    GROUP_BY_OPTIONS.some(o => o.value === groupParam) ? groupParam : 'function'
  ) as GroupBy;
  const def = METRICS[metric];
  const grouped = groupedSeries(fns, metric, window, groupBy);
  const stacked = def.aggregation === 'sum';

  return (
    <ChartWidget
      title={t(
        '%s by %s',
        def.label,
        GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label.toLowerCase() ?? groupBy
      )}
      source={def.source}
      height={220}
      window={window}
      releasesFor={fns}
      plottables={w =>
        groupedSeries(fns, metric, w, groupBy).map(series =>
          stacked
            ? new Bars(series, {
                alias: series.yAxis,
                stack: 'all',
                color: colorOf(series.yAxis),
              })
            : new Line(series, {alias: series.yAxis, color: colorOf(series.yAxis)})
        )
      }
      note={
        grouped.length > 1
          ? t('Top %s, the rest grouped as Other', Math.min(grouped.length, 4))
          : undefined
      }
      titleControls={
        <Flex gap="xs" minWidth="0">
          <CompactSelect
            value={metric}
            options={EXPLORE_METRICS.map(key => ({
              value: key,
              label: METRICS[key].label,
            }))}
            onChange={option =>
              setMetric(option.value === 'invocations' ? undefined : option.value)
            }
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} size="xs" />
            )}
          />
          <CompactSelect
            value={groupBy}
            options={GROUP_BY_OPTIONS}
            onChange={option =>
              setGroup(option.value === 'function' ? undefined : option.value)
            }
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps} size="xs" prefix={t('By')} />
            )}
          />
        </Flex>
      }
    />
  );
}

function sortValue(
  fn: LambdaFunction,
  window: TimeWindow,
  key: SortKey
): number | string {
  const t0 = totals([fn], window);
  switch (key) {
    case 'name':
      return fn.name;
    case 'invocations':
      return t0.invocations;
    case 'failure':
      return failureRate(t0);
    case 'throttles':
      return t0.throttles;
    case 'killed':
      return t0.timeouts + t0.oom;
    case 'p95':
      return t0.p95;
    case 'cold':
      return coldStartRate(t0);
    case 'memory':
      return t0.memory / fn.memoryMb;
    case 'cost':
      return t0.cost;
    default:
      return 0;
  }
}

const HEALTH_ORDER = {critical: 0, warning: 1, healthy: 2};

function FunctionsTable({
  fns,
  window,
  organization,
  timeQuery,
}: {
  fns: LambdaFunction[];
  organization: Organization;
  timeQuery: Record<string, unknown>;
  window: TimeWindow;
}) {
  const navigate = useNavigate();
  const {openDrawer, isDrawerOpen} = useDrawer();
  const [active, setActive] = useState<number | null>(null);
  const [sortParam, setSort] = useUrlState('sort');
  const sortKey = (sortParam?.replace(/^-/, '') ?? 'health') as SortKey | 'health';
  const descending = sortParam ? sortParam.startsWith('-') : true;

  const [groupParam] = useUrlState('tableGroup');
  const grouping = FACETS.find(facet => facet.key === groupParam);

  const rows = useMemo(() => {
    const list = fns.map(fn => ({
      fn,
      t: totals([fn], window),
      health: health(fn, totals([fn], window)),
    }));
    const group = (fn: LambdaFunction) => (grouping ? grouping.value(fn) : '');
    return list.sort((a, b) => {
      if (group(a.fn) !== group(b.fn)) {
        return group(a.fn).localeCompare(group(b.fn));
      }
      if (sortKey === 'health') {
        return (
          HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] ||
          b.t.invocations - a.t.invocations
        );
      }
      const av = sortValue(a.fn, window, sortKey);
      const bv = sortValue(b.fn, window, sortKey);
      const cmp =
        typeof av === 'string' ? av.localeCompare(bv as string) : av - (bv as number);
      return descending ? -cmp : cmp;
    });
  }, [fns, window, sortKey, descending, grouping]);

  const openPreview = (fn: LambdaFunction) =>
    openDrawer(
      () => (
        <FunctionPreview
          key={fn.name}
          fn={fn}
          window={window}
          organization={organization}
          timeQuery={timeQuery}
        />
      ),
      {
        ariaLabel: t('Preview of %s', fn.name),
        drawerKey: 'lambda-function-preview',
        drawerWidth: '44%',
        mode: 'passive',
        resizable: true,
      }
    );

  // j/k (or arrows) move through functions, Enter previews, o opens the function page.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        ['INPUT', 'TEXTAREA'].includes(target?.tagName ?? '') ||
        target?.isContentEditable ||
        event.metaKey ||
        event.ctrlKey
      ) {
        return;
      }
      if (
        event.key === 'j' ||
        event.key === 'ArrowDown' ||
        event.key === 'k' ||
        event.key === 'ArrowUp'
      ) {
        event.preventDefault();
        const step = event.key === 'j' || event.key === 'ArrowDown' ? 1 : -1;
        const next = Math.min(rows.length - 1, Math.max(0, (active ?? -1) + step));
        setActive(next);
        if (isDrawerOpen) {
          openPreview(rows[next]!.fn);
        }
      } else if (event.key === 'Enter' && active !== null) {
        openPreview(rows[active]!.fn);
      } else if (event.key === 'o' && active !== null) {
        navigate(functionUrl(organization, rows[active]!.fn.name, timeQuery));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  const header = (key: SortKey, label: string) => (
    <SimpleTable.HeaderCell
      sort={sortKey === key ? (descending ? 'desc' : 'asc') : undefined}
      handleSortClick={() => setSort(sortKey === key && descending ? key : `-${key}`)}
    >
      {label}
    </SimpleTable.HeaderCell>
  );

  if (!rows.length) {
    return (
      <Container border="primary" radius="md" padding="xl">
        <Text variant="muted">{t('No functions match these filters.')}</Text>
      </Container>
    );
  }

  return (
    <FunctionsGrid>
      <SimpleTable.Header>
        {header('name', t('Function'))}
        <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
        {header('invocations', t('Invocations'))}
        {header('failure', t('Failure rate'))}
        {header('p95', t('p95'))}
        {header('cold', t('Cold starts'))}
        {header('memory', t('Memory'))}
        {header('cost', t('Cost'))}
        <SimpleTable.HeaderCell>{null}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {rows.map(({fn, t: t0, health: fnHealth}, index) => {
        const fnInsights = insightsFor(fn, window);
        const top = fnInsights[0];
        const groupValue = grouping?.value(fn);
        const groupStart =
          grouping && (index === 0 || grouping.value(rows[index - 1]!.fn) !== groupValue);
        return (
          <Fragment key={fn.name}>
            {groupStart && (
              <GroupHeader
                label={`${grouping.label}: ${groupValue}`}
                fns={rows
                  .filter(row => grouping.value(row.fn) === groupValue)
                  .map(row => row.fn)}
                window={window}
              />
            )}
            <ClickableRow
              active={rows[active ?? -1]?.fn.name === fn.name}
              onClick={event => {
                if (event.metaKey || event.ctrlKey) {
                  navigate(functionUrl(organization, fn.name, timeQuery));
                  return;
                }
                setActive(rows.findIndex(row => row.fn.name === fn.name));
                openPreview(fn);
              }}
            >
              <SimpleTable.RowCell>
                <Flex gap="sm" align="center" minWidth="0">
                  <HealthDot health={fnHealth} />
                  <Stack gap="0" minWidth="0">
                    <Link
                      to={functionUrl(organization, fn.name, timeQuery)}
                      onClick={event => event.stopPropagation()}
                    >
                      <Text bold ellipsis>
                        {fn.name}
                      </Text>
                    </Link>
                    <Text size="xs" variant="muted" ellipsis>
                      {fn.triggers[0]!.label} · {fn.runtime} · {fn.memoryMb} MB
                    </Text>
                  </Stack>
                </Flex>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                {top ? (
                  <Tooltip
                    title={fnInsights.map(insight => insight.title).join(' · ')}
                    skipWrapper
                  >
                    <Flex gap="sm" align="center" minWidth="0">
                      {top.severity === 'danger' ? (
                        <IconFire size="xs" variant="danger" />
                      ) : top.severity === 'warning' ? (
                        <IconWarning size="xs" variant="warning" />
                      ) : (
                        <IconInfo size="xs" variant="muted" />
                      )}
                      <Text size="sm" ellipsis>
                        {top.title}
                      </Text>
                      {fnInsights.length > 1 && (
                        <Text size="xs" variant="muted" wrap="nowrap">
                          {t('+%s', fnInsights.length - 1)}
                        </Text>
                      )}
                    </Flex>
                  </Tooltip>
                ) : (
                  <Text size="sm" variant="muted">
                    {t('Healthy')}
                  </Text>
                )}
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Flex gap="sm" align="center">
                  <Sparkline
                    values={metricSeries([fn], 'invocations', window).values.map(
                      v => v.value
                    )}
                    width={64}
                    height={20}
                  />
                  <Text tabular>{formatCount(t0.invocations)}</Text>
                </Flex>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text tabular>{formatPct(failureRate(t0), 2)}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <InfoText
                  title={t('p99 %s of a %ss timeout', formatMs(t0.p99), fn.timeoutS)}
                  tabular
                >
                  {formatMs(t0.p95)}
                </InfoText>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text tabular>{formatPct(coldStartRate(t0))}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <MemoryBar used={t0.memory} limit={fn.memoryMb} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell justify="end">
                <Text tabular>{formatUsd(t0.cost)}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <RowActions onClick={event => event.stopPropagation()}>
                  <LinkButton
                    size="xs"
                    icon={<IconList />}
                    to={functionUrl(organization, fn.name, timeQuery, {
                      tab: 'invocations',
                    })}
                    aria-label={t('Invocations')}
                    tooltipProps={{title: t('Invocations')}}
                  />
                  <LinkButton
                    size="xs"
                    icon={<IconTerminal />}
                    to={functionUrl(organization, fn.name, timeQuery, {tab: 'logs'})}
                    aria-label={t('Logs')}
                    tooltipProps={{title: t('Logs')}}
                  />
                </RowActions>
              </SimpleTable.RowCell>
            </ClickableRow>
          </Fragment>
        );
      })}
    </FunctionsGrid>
  );
}

function TableGroupSelect() {
  const [groupParam, setGroup] = useUrlState('tableGroup');
  return (
    <CompactSelect
      value={groupParam ?? ''}
      options={[
        {value: '', label: t('No grouping')},
        ...FACETS.map(facet => ({value: facet.key, label: facet.label})),
      ]}
      onChange={option => setGroup(option.value || undefined)}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} size="xs" prefix={t('Group')} />
      )}
    />
  );
}

/** Totals for a group of functions, like Datadog's service grouping. */
function GroupHeader({
  label,
  fns,
  window,
}: {
  fns: LambdaFunction[];
  label: string;
  window: TimeWindow;
}) {
  const t0 = totals(fns, window);
  return (
    <GroupRow>
      <Text size="sm" bold>
        {label}
      </Text>
      <Text size="xs" variant="muted" tabular>
        {t(
          '%s functions · %s invocations · %s failed · p95 %s · %s',
          fns.length,
          formatCount(t0.invocations),
          formatPct(failureRate(t0), 2),
          formatMs(t0.p95),
          formatUsd(t0.cost)
        )}
      </Text>
    </GroupRow>
  );
}

const GroupRow = styled('div')`
  grid-column: 1 / -1;
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: baseline;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
  background: ${p => p.theme.tokens.background.secondary};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;

function FunctionsMap({
  fns,
  window,
  organization,
}: {
  fns: LambdaFunction[];
  organization: Organization;
  window: TimeWindow;
}) {
  const navigate = useNavigate();
  const timeQuery = useTimeQuery();
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  const maxInv = Math.max(1, ...fns.map(fn => totals([fn], window).invocations));
  for (const fn of fns) {
    const t0 = totals([fn], window);
    const fnHealth = health(fn, t0);
    nodes.push({
      id: fn.name,
      column: 1,
      label: fn.name,
      sublabel: `${formatCount(t0.invocations)} inv · ${formatPct(failureRate(t0), 1)} failed · p95 ${formatMs(t0.p95)}`,
      variant: fnHealth,
    });
    for (const dep of dependencies(fn)) {
      const id = `${dep.kind}:${dep.label}`;
      if (!seen.has(id)) {
        seen.add(id);
        nodes.push({
          id,
          column: dep.kind === 'trigger' ? 0 : 2,
          label: dep.label,
          sublabel: dep.op,
          variant: dep.errorRate > 0.02 ? 'critical' : 'neutral',
        });
      }
      const weight =
        1 +
        5 *
          Math.sqrt(t0.invocations / maxInv) *
          (dep.kind === 'trigger' ? 1 : Math.min(1, dep.callsPerInvocation));
      edges.push(
        dep.kind === 'trigger'
          ? {
              from: id,
              to: fn.name,
              weight,
              label: `${formatCount(t0.invocations)} invocations`,
              variant: t0.throttles > 0 ? 'danger' : 'neutral',
            }
          : {
              from: fn.name,
              to: id,
              weight,
              label: `p95 ${formatMs(dep.p95Ms)} · ${formatPct(dep.errorRate, 1)} errors`,
              variant: dep.errorRate > 0.02 ? 'danger' : 'neutral',
            }
      );
    }
  }
  return (
    <Container border="primary" radius="md" padding="lg">
      <Stack gap="sm">
        <Text size="xs" variant="muted">
          {t(
            'Event sources → functions → downstream resources, from trace data. Hover to focus, click a function to open it.'
          )}
        </Text>
        <ServiceMap
          nodes={nodes}
          edges={edges}
          highlighted={highlighted}
          onNodeClick={id => {
            if (fns.some(fn => fn.name === id)) {
              navigate(functionUrl(organization, id, timeQuery));
            } else {
              setHighlighted(highlighted === id ? null : id);
            }
          }}
        />
      </Stack>
    </Container>
  );
}

const FunctionsGrid = styled(SimpleTable)`
  grid-template-columns:
    minmax(220px, 1.4fr) minmax(
      220px,
      2fr
    ) max-content max-content max-content max-content
    minmax(110px, 0.8fr) max-content max-content;
`;

const RowActions = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xs};
  opacity: 0;
  transition: opacity 0.1s;

  [role='row']:hover & {
    opacity: 1;
  }
`;

const ClickableRow = styled(SimpleTable.Row, {
  shouldForwardProp: prop => !['active'].includes(prop),
})<{active: boolean}>`
  cursor: pointer;
  background: ${p => (p.active ? p.theme.tokens.background.secondary : 'transparent')};
  box-shadow: ${p =>
    p.active ? `inset 3px 0 0 ${p.theme.tokens.graphics.accent.vibrant}` : 'none'};
  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

function HealthChips({counts}: {counts: Record<string, number>}) {
  const [values, setValues] = useUrlListState('health');
  return (
    <Flex gap="xs">
      {(['critical', 'warning', 'healthy'] as const).map(value => {
        const active = values.includes(value);
        return (
          <Tooltip
            key={value}
            title={active ? t('Show all functions') : t('Only show %s functions', value)}
          >
            <HealthChip
              active={active}
              onClick={() =>
                setValues(active ? values.filter(v => v !== value) : [value])
              }
              aria-pressed={active}
            >
              <HealthDot health={value} />
              <Text size="xs" tabular>
                {counts[value] ?? 0}
              </Text>
            </HealthChip>
          </Tooltip>
        );
      })}
    </Flex>
  );
}

const HealthChip = styled('button')<{active: boolean}>`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: 2px ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.full};
  border: 1px solid
    ${p => (p.active ? p.theme.tokens.border.accent : p.theme.tokens.border.primary)};
  background: ${p => (p.active ? p.theme.tokens.background.secondary : 'transparent')};
  color: inherit;
  cursor: pointer;
`;

const MonitorList = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;

const MonitorRow = styled('div')`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  gap: ${p => p.theme.space.md};
  align-items: center;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

function FunctionPreview({
  fn,
  window,
  organization,
  timeQuery,
}: {
  fn: LambdaFunction;
  organization: Organization;
  timeQuery: Record<string, unknown>;
  window: TimeWindow;
}) {
  const colors = useSeriesColors();
  const statColors = useStatColors();
  const navigate = useNavigate();
  const showInvocations = ([from, to]: [number, number]) =>
    navigate(
      functionUrl(organization, fn.name, timeQuery, {
        tab: 'invocations',
        sel: `${from},${to},0,${fn.timeoutS * 2000}`,
      })
    );
  const t0 = totals([fn], window);
  const fnHealth = health(fn, t0);
  const failed = invocations(fn, window)
    .filter(inv => inv.status !== 'ok')
    .slice(0, 6);
  const facts: Array<[string, string, 'danger' | 'warning' | undefined]> = [
    [t('Invocations'), formatCount(t0.invocations), undefined],
    [
      t('Failure rate'),
      formatPct(failureRate(t0), 2),
      failureRate(t0) > 0.01 ? 'danger' : undefined,
    ],
    [
      t('Timeouts / OOM'),
      `${formatCount(t0.timeouts)} / ${formatCount(t0.oom)}`,
      t0.timeouts + t0.oom > 0 ? 'danger' : undefined,
    ],
    [
      t('p95'),
      formatMs(t0.p95),
      t0.p99 / (fn.timeoutS * 1000) > 0.95 ? 'danger' : undefined,
    ],
    [t('Cold starts'), formatPct(coldStartRate(t0)), undefined],
    [t('Cost'), formatUsd(t0.cost), undefined],
  ];
  return (
    <Stack height="100%">
      <DrawerHeader>
        <Flex gap="sm" align="center">
          <HealthDot health={fnHealth} />
          <Text bold>{fn.name}</Text>
          <Tag variant="muted">{fn.triggers[0]!.label}</Tag>
        </Flex>
      </DrawerHeader>
      <DrawerBody>
        <Stack gap="lg">
          <Grid columns="repeat(3, 1fr)" gap="sm">
            {facts.map(([label, value, variant]) => (
              <Container key={label} border="primary" radius="md" padding="sm md">
                <Stack gap="0">
                  <Text size="xs" variant="muted">
                    {label}
                  </Text>
                  <Text bold tabular variant={variant}>
                    {value}
                  </Text>
                </Stack>
              </Container>
            ))}
          </Grid>
          <ChartWidget
            title={t('Failures')}
            source="extension"
            height={170}
            window={window}
            releasesFor={[fn]}
            onShowInvocations={showInvocations}
            note={t(
              '%s of %s invocations failed',
              formatCount(t0.errors + t0.timeouts + t0.oom),
              formatCount(t0.invocations)
            )}
            plottables={w => [
              new Bars(metricSeries([fn], 'errors', w), {
                alias: t('errors'),
                stack: 'f',
                color: colors.errors,
              }),
              new Bars(metricSeries([fn], 'timeouts', w), {
                alias: t('timeouts'),
                stack: 'f',
                color: colors.timeouts,
              }),
              new Bars(metricSeries([fn], 'oom', w), {
                alias: t('out of memory'),
                stack: 'f',
                color: colors.oom,
              }),
            ]}
          />
          <ChartWidget
            title={t('Duration')}
            source="spans"
            height={170}
            window={window}
            releasesFor={[fn]}
            onShowInvocations={showInvocations}
            stats={['p50', 'p95']}
            note={t(
              'p95 %s, p99 %s of a %ss timeout',
              formatMs(t0.p95),
              formatMs(t0.p99),
              fn.timeoutS
            )}
            plottables={(w, stats) => [
              ...stats.map(
                stat =>
                  new Line(metricSeries([fn], stat, w, STAT_LABEL[stat]), {
                    alias: STAT_LABEL[stat],
                    color: statColors[stat],
                  })
              ),
              ...(t0.p99 >= fn.timeoutS * 300
                ? [
                    limitLine(
                      constantSeries(w, fn.timeoutS * 1000, t('timeout'), 'p95'),
                      t('timeout'),
                      colors.limit
                    ),
                  ]
                : []),
            ]}
          />
          <InsightCards
            insights={insightsFor(fn, window)}
            organization={organization}
            timeQuery={timeQuery}
            showFunction={false}
            emptyMessage={t('Healthy in this time range.')}
          />
          {failed.length > 0 && (
            <Stack gap="xs">
              <Text bold size="sm">
                {t('Recent failed invocations')}
              </Text>
              <Container border="primary" radius="md" overflow="hidden">
                {failed.map(inv => (
                  <PreviewInvocation
                    key={inv.id}
                    to={functionUrl(organization, fn.name, timeQuery, {
                      tab: 'invocations',
                      invocation: inv.id,
                    })}
                  >
                    <StatusTag status={inv.status} />
                    <Text size="xs" ellipsis>
                      {inv.errorType ?? inv.trigger}
                    </Text>
                    <Text size="xs" variant="muted" tabular>
                      {formatMs(inv.durationMs)}
                    </Text>
                  </PreviewInvocation>
                ))}
              </Container>
            </Stack>
          )}
          <Flex gap="sm">
            <LinkButton
              size="sm"
              variant="primary"
              to={functionUrl(organization, fn.name, timeQuery)}
            >
              {t('Open %s', fn.name)}
            </LinkButton>
            <LinkButton
              size="sm"
              to={functionUrl(organization, fn.name, timeQuery, {tab: 'invocations'})}
            >
              {t('Invocations')}
            </LinkButton>
            <LinkButton
              size="sm"
              to={functionUrl(organization, fn.name, timeQuery, {tab: 'logs'})}
            >
              {t('Logs')}
            </LinkButton>
          </Flex>
        </Stack>
      </DrawerBody>
    </Stack>
  );
}

const PreviewInvocation = styled(Link)`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  gap: ${p => p.theme.space.sm};
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  color: inherit;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;
