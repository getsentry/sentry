import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Badge, Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Text} from '@sentry/scraps/text';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {ServiceMap} from 'sentry/views/insights/awsLambda/charts';
import {
  ChartWidget,
  exploreUrl,
  formatCount,
  formatMs,
  formatPct,
  formatUsd,
  InsightCards,
  Kpi,
  KpiRow,
  lambdaUrl,
  KpiSkeletonRow,
  limitLine,
  LoadingBar,
  MockBadge,
  RefreshControl,
  Refreshing,
  ReinstrumentButton,
  UpdatedAgo,
  SectionTitle,
  STAT_LABEL,
  useSeriesColors,
  useStatColors,
  windowLabel,
} from 'sentry/views/insights/awsLambda/components';
import {
  useLambdaWindow,
  useMockQuery,
  useTimeQuery,
} from 'sentry/views/insights/awsLambda/hooks';
import {
  coldStartRate,
  coldStartRateSeries,
  constantSeries,
  dependencies,
  failureRate,
  DEPRECATED_RUNTIMES,
  FUNCTIONS,
  getFunction,
  health,
  insightsFor,
  issuesFor,
  type LambdaFunction,
  type MetricKey,
  memoryLimitSeries,
  metricSeries,
  releaseAt,
  STATUS_LABELS,
  type TimeWindow,
  totals,
} from 'sentry/views/insights/awsLambda/mockData';
import {useMockStore} from 'sentry/views/insights/awsLambda/mockStore';
import {
  ColdStartsTab,
  CostTab,
  ReleasesTab,
} from 'sentry/views/insights/awsLambda/views/analysisTabs';
import {InvocationsTab} from 'sentry/views/insights/awsLambda/views/invocationsTab';
import {LogsTab} from 'sentry/views/insights/awsLambda/views/logsTab';
import {AWS_LAMBDA_TITLE} from 'sentry/views/insights/awsLambda/views/overview';
import {TopBar} from 'sentry/views/navigation/topBar';

const TABS = [
  {key: 'overview', label: t('Overview')},
  {key: 'invocations', label: t('Invocations')},
  {key: 'cold-starts', label: t('Cold starts')},
  {key: 'cost', label: t('Memory & cost')},
  {key: 'dependencies', label: t('Dependencies')},
  {key: 'logs', label: t('Logs')},
  {key: 'releases', label: t('Releases')},
  {key: 'configuration', label: t('Configuration')},
] as const;

export default function AwsLambdaFunctionDetails() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const lambdaWindow = useLambdaWindow();
  const {window, previous, live, now} = lambdaWindow;
  const timeQuery = useTimeQuery();
  const fn = getFunction(decodeScalar(location.query.name));
  const tab = decodeScalar(location.query.tab) ?? 'overview';
  useMockStore();
  const query = useMockQuery(
    ['function', decodeScalar(location.query.name), window.start, window.end, now],
    () => {
      const target = getFunction(decodeScalar(location.query.name));
      return target ? totals([target], window) : null;
    }
  );

  if (!fn) {
    return (
      <Layout.Body>
        <Layout.Main width="full">
          <EmptyStateWarning>
            <p>{t('Unknown function.')}</p>
            <Link to={lambdaUrl(organization)}>{t('Back to AWS Lambda')}</Link>
          </EmptyStateWarning>
        </Layout.Main>
      </Layout.Body>
    );
  }

  const t0 = totals([fn], window);

  return (
    <SentryDocumentTitle
      title={`${fn.name} · ${AWS_LAMBDA_TITLE}`}
      orgSlug={organization.slug}
    >
      <PageFiltersContainer>
        <Layout.Title>
          <Flex align="center" gap="sm">
            <Link to={{pathname: lambdaUrl(organization), query: timeQuery}}>
              {AWS_LAMBDA_TITLE}
            </Link>
            <Text variant="muted">/</Text>
            <FunctionSwitcher current={fn} />
            <MockBadge />
          </Flex>
        </Layout.Title>
        <TopBar.Slot name="actions">
          <Flex gap="sm">
            <LinkButton
              size="sm"
              icon={<IconOpen />}
              to={exploreUrl(organization, `span.op:function.aws faas.name:${fn.name}`)}
            >
              {t('Open in Explore')}
            </LinkButton>
            <LinkButton
              size="sm"
              to={{
                pathname: `/organizations/${organization.slug}/issues/`,
                query: {query: `faas.name:${fn.name}`},
              }}
            >
              {t('Issues')}
            </LinkButton>
          </Flex>
        </TopBar.Slot>
        <Layout.Body>
          <Layout.Main width="full">
            <Stack gap="lg">
              <Stack gap="xs">
                <FunctionHeader
                  fn={fn}
                  window={window}
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
                  {query.data && <UpdatedAgo at={query.dataUpdatedAt} />}
                </Flex>
              </Stack>

              <Tabs
                value={tab}
                onChange={key =>
                  navigate(
                    {
                      ...location,
                      query: {
                        ...location.query,
                        tab: key === 'overview' ? undefined : key,
                      },
                    },
                    {replace: true}
                  )
                }
              >
                <TabList>
                  {TABS.map(item => (
                    <TabList.Item key={item.key} textValue={item.label}>
                      <Flex gap="xs" align="center">
                        {item.label}
                        {tabBadge(item.key, fn, t0)}
                      </Flex>
                    </TabList.Item>
                  ))}
                </TabList>
                {/* Auto-refresh updates in place; only user changes dim the page. */}
                <Refreshing active={!live && query.isFetching && query.isPlaceholderData}>
                  <WidgetSyncContextProvider groupName="aws-lambda-function">
                    {query.isPending ? (
                      <Stack gap="lg" paddingTop="lg">
                        <KpiSkeletonRow />
                        <Placeholder height="520px" />
                      </Stack>
                    ) : (
                      <TabPanels>
                        <TabPanels.Item key="overview">
                          {tab === 'overview' && (
                            <OverviewTab
                              fn={fn}
                              window={window}
                              previous={previous}
                              organization={organization}
                            />
                          )}
                        </TabPanels.Item>
                        <TabPanels.Item key="invocations">
                          {tab === 'invocations' && (
                            <InvocationsTab
                              fn={fn}
                              window={window}
                              now={now}
                              live={live}
                            />
                          )}
                        </TabPanels.Item>
                        <TabPanels.Item key="cold-starts">
                          {tab === 'cold-starts' && (
                            <ColdStartsTab fn={fn} window={window} previous={previous} />
                          )}
                        </TabPanels.Item>
                        <TabPanels.Item key="cost">
                          {tab === 'cost' && (
                            <CostTab fn={fn} window={window} previous={previous} />
                          )}
                        </TabPanels.Item>
                        <TabPanels.Item key="dependencies">
                          {tab === 'dependencies' && (
                            <DependenciesTab
                              fn={fn}
                              window={window}
                              organization={organization}
                            />
                          )}
                        </TabPanels.Item>
                        <TabPanels.Item key="logs">
                          {tab === 'logs' && <LogsTab fn={fn} window={window} />}
                        </TabPanels.Item>
                        <TabPanels.Item key="releases">
                          {tab === 'releases' && <ReleasesTab fn={fn} window={window} />}
                        </TabPanels.Item>
                        <TabPanels.Item key="configuration">
                          {tab === 'configuration' && <ConfigurationTab fn={fn} />}
                        </TabPanels.Item>
                      </TabPanels>
                    )}
                  </WidgetSyncContextProvider>
                </Refreshing>
              </Tabs>
            </Stack>
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

function OverviewTab({
  fn,
  window,
  previous,
  organization,
}: {
  fn: LambdaFunction;
  organization: Organization;
  previous: TimeWindow;
  window: TimeWindow;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const timeQuery = useTimeQuery();
  const theme = useTheme();
  const t0 = totals([fn], window);
  const before = totals([fn], previous);
  const series = (metric: MetricKey) =>
    metricSeries([fn], metric, window).values.map(v => v.value);
  const goTo = (tab: string, query: Record<string, string> = {}) =>
    navigate({...location, query: {...location.query, tab, ...query}});
  const statColors = useStatColors();
  const chartProps = {
    window,
    releasesFor: [fn],
    onShowInvocations: ([from, to]: [number, number]) =>
      goTo('invocations', {sel: `${from},${to},0,${fn.timeoutS * 2000}`}),
  };
  const kind = fn.triggers[0]!.kind;
  const colors = useSeriesColors();
  const timeoutMs = fn.timeoutS * 1000;
  const failed = t0.errors + t0.timeouts + t0.oom;

  const p95Series = metricSeries([fn], 'p95', window);
  const p95Peak = Math.max(0, ...p95Series.values.map(v => v.value ?? 0));
  const showTimeout = t0.p99 >= timeoutMs * 0.3;
  const latestRelease = releaseAt(fn, window.end);
  const deployedInWindow =
    latestRelease.deployedAt > window.start + window.interval &&
    latestRelease.deployedAt < window.end - window.interval;
  const p95Before = totals([fn], {...window, end: latestRelease.deployedAt}).p95;
  const p95After = totals([fn], {...window, start: latestRelease.deployedAt}).p95;

  const coldStartChart = (
    <ChartWidget
      title={t('Cold start rate')}
      height={220}
      source="extension"
      {...chartProps}
      note={t(
        '%s of invocations, init p95 %s',
        formatPct(coldStartRate(t0)),
        formatMs(t0.initP95)
      )}
      plottables={w => [
        new Line(coldStartRateSeries(fn, w), {
          alias: t('cold start rate'),
          color: theme.tokens.graphics.accent.vibrant,
        }),
      ]}
    />
  );

  return (
    <Stack gap="xl" paddingTop="lg">
      <KpiRow>
        <Kpi
          label={t('Invocations')}
          value={formatCount(t0.invocations)}
          current={t0.invocations}
          previous={before.invocations}
          polarity="neutral"
          series={series('invocations')}
          detail={windowLabel(window)}
          onClick={() => goTo('invocations')}
        />
        <Kpi
          label={t('Failure rate')}
          value={formatPct(failureRate(t0), 2)}
          current={failureRate(t0)}
          previous={failureRate(before)}
          series={series('errors')}
          variant={failureRate(t0) > 0.01 ? 'danger' : undefined}
          detail={t(
            '%s errors · %s timeouts · %s OOM',
            formatCount(t0.errors),
            formatCount(t0.timeouts),
            formatCount(t0.oom)
          )}
          onClick={() => goTo('invocations', {status: 'error'})}
        />
        <Kpi
          label={t('Duration p95')}
          value={formatMs(t0.p95)}
          current={t0.p95}
          previous={before.p95}
          series={series('p95')}
          variant={t0.p99 / timeoutMs > 0.95 ? 'danger' : undefined}
          detail={t('p99 %s · timeout %ss', formatMs(t0.p99), fn.timeoutS)}
          onClick={() => goTo('invocations')}
        />
        <Kpi
          label={t('Cold starts')}
          value={formatPct(coldStartRate(t0))}
          current={coldStartRate(t0)}
          previous={coldStartRate(before)}
          series={series('coldStarts')}
          detail={t('init p95 %s', formatMs(t0.initP95))}
          onClick={() => goTo('cold-starts')}
        />
        <Kpi
          label={t('Max memory')}
          value={`${Math.round(t0.memory)} MB`}
          current={t0.memory}
          previous={before.memory}
          series={series('memory')}
          variant={t0.memory / fn.memoryMb >= 0.95 ? 'danger' : undefined}
          detail={t(
            '%s of %s MB configured',
            formatPct(t0.memory / fn.memoryMb, 0),
            fn.memoryMb
          )}
          onClick={() => goTo('cost')}
        />
        <Kpi
          label={t('Estimated cost')}
          value={formatUsd(t0.cost)}
          current={t0.cost}
          previous={before.cost}
          series={series('cost')}
          detail={t(
            '%s per 1M invocations',
            formatUsd((t0.cost / Math.max(1, t0.invocations)) * 1e6)
          )}
          onClick={() => goTo('cost')}
        />
      </KpiRow>

      <InsightCards
        insights={insightsFor(fn, window)}
        organization={organization}
        timeQuery={timeQuery}
        showFunction={false}
        emptyMessage={t('This function looks healthy in this time range.')}
      />

      <Grid columns={{xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr'}} gap="md">
        <ChartWidget
          title={t('Invocations')}
          source="extension"
          height={220}
          {...chartProps}
          description={t(
            'Every invocation, plus requests Lambda throttled before they ran.'
          )}
          note={
            t0.throttles > 0
              ? t('%s requests throttled', formatCount(t0.throttles))
              : t(
                  'Peak %s per %s',
                  formatCount(Math.max(0, ...series('invocations').map(v => v ?? 0))),
                  windowLabel({...window, end: window.start + window.interval}).replace(
                    'last ',
                    ''
                  )
                )
          }
          plottables={w => [
            new Bars(metricSeries([fn], 'invocations', w), {
              alias: t('invocations'),
              stack: 'i',
              color: theme.tokens.graphics.accent.vibrant,
            }),
            ...(fn.reservedConcurrency || t0.throttles > 0
              ? [
                  new Bars(metricSeries([fn], 'throttles', w), {
                    alias: t('throttled'),
                    stack: 'i',
                    color: colors.throttles,
                  }),
                ]
              : []),
          ]}
        />
        <ChartWidget
          title={t('Failures')}
          source="extension"
          height={220}
          {...chartProps}
          description={t(
            'Invocations that ended in an error, a timeout or an out-of-memory kill.'
          )}
          note={
            failed > 0
              ? t(
                  '%s of %s invocations failed (%s)',
                  formatCount(failed),
                  formatCount(t0.invocations),
                  formatPct(failureRate(t0), 2)
                )
              : t('No failed invocations')
          }
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
          height={220}
          {...chartProps}
          stats={['p50', 'p95']}
          description={t(
            'Percentiles of invocation duration: p95 is the duration 95% of invocations stay under. The timeout line is shown when p99 gets within reach of it.'
          )}
          note={
            deployedInWindow && Math.abs(p95After / Math.max(1, p95Before) - 1) > 0.1
              ? t(
                  'p95 %s from %s to %s after %s',
                  p95After > p95Before ? t('rose') : t('fell'),
                  formatMs(p95Before),
                  formatMs(p95After),
                  latestRelease.release
                )
              : t(
                  'p95 peaked at %s, %s of the %ss timeout',
                  formatMs(p95Peak),
                  formatPct(p95Peak / timeoutMs, 0),
                  fn.timeoutS
                )
          }
          plottables={(w, stats) => [
            ...stats.map(
              stat =>
                new Line(metricSeries([fn], stat, w, STAT_LABEL[stat]), {
                  alias: STAT_LABEL[stat],
                  color: statColors[stat],
                })
            ),
            ...(showTimeout || stats.includes('maxDuration')
              ? [
                  limitLine(
                    constantSeries(w, timeoutMs, t('timeout'), 'p95'),
                    t('timeout'),
                    colors.limit
                  ),
                ]
              : []),
          ]}
        />
        <ChartWidget
          title={t('Memory')}
          source="extension"
          height={220}
          {...chartProps}
          description={t(
            'Highest memory used by an invocation in each interval, against the configured memory size.'
          )}
          note={t(
            'Peaked at %s MB of %s MB (%s)',
            Math.round(t0.memory),
            fn.memoryMb,
            formatPct(t0.memory / fn.memoryMb, 0)
          )}
          plottables={w => [
            new Line(metricSeries([fn], 'memory', w), {
              alias: t('max used'),
              color: theme.tokens.graphics.accent.vibrant,
            }),
            limitLine(
              memoryLimitSeries(fn, w, t('configured')),
              t('configured'),
              theme.tokens.graphics.neutral.moderate
            ),
          ]}
        />
        {kind !== 'api-gateway' &&
          kind !== 'function-url' &&
          kind !== 's3' &&
          kind !== 'schedule' &&
          kind !== 'durable' &&
          coldStartChart}
        {kind === 'dynamodb' ? (
          <ChartWidget
            title={t('Stream lag (iterator age)')}
            height={220}
            source="integration"
            {...chartProps}
            note={t('Worst lag %s', formatMs(t0.iteratorAge ?? 0))}
            plottables={w => [
              new Line(metricSeries([fn], 'iteratorAge', w), {
                alias: t('iterator age'),
                color: theme.tokens.graphics.accent.vibrant,
              }),
            ]}
          />
        ) : kind === 'sqs' ? (
          <ChartWidget
            title={t('Partial batch failures')}
            height={220}
            source="spans"
            {...chartProps}
            description={t(
              'Records reported back to SQS as failed (batchItemFailures); they are retried, then sent to the DLQ.'
            )}
            note={t(
              '%s records failed and will be retried',
              formatCount(t0.batchFailures)
            )}
            plottables={w => [
              new Bars(metricSeries([fn], 'batchFailures', w), {
                alias: t('failed records'),
                color: colors.errors,
              }),
            ]}
          />
        ) : kind === 'sns' ? (
          <ChartWidget
            title={t('Concurrency')}
            height={220}
            source="integration"
            {...chartProps}
            note={
              fn.reservedConcurrency
                ? t(
                    'Capped at reserved concurrency %s; %s async events dropped',
                    fn.reservedConcurrency,
                    formatCount(t0.asyncDropped)
                  )
                : undefined
            }
            plottables={w => [
              new Line(metricSeries([fn], 'concurrency', w), {
                alias: t('concurrent executions'),
                color: theme.tokens.graphics.accent.vibrant,
              }),
              ...(fn.reservedConcurrency
                ? [
                    limitLine(
                      constantSeries(
                        w,
                        fn.reservedConcurrency,
                        t('reserved'),
                        'concurrency'
                      ),
                      t('reserved'),
                      colors.limit
                    ),
                  ]
                : []),
            ]}
          />
        ) : (
          coldStartChart
        )}
      </Grid>

      <Grid columns={{xs: '1fr', lg: '3fr 2fr'}} gap="md">
        <Stack gap="md">
          <SectionTitle>{t('Issues')}</SectionTitle>
          <IssuesTable>
            <SimpleTable.Header>
              <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Reported by')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Events')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('First seen')}</SimpleTable.HeaderCell>
            </SimpleTable.Header>
            {issuesFor(fn, window).map(issue => (
              <SimpleTable.Row key={issue.shortId}>
                <SimpleTable.RowCell>
                  <Stack gap="0" minWidth="0">
                    <Text bold ellipsis>
                      {issue.title}
                    </Text>
                    <Text size="xs" variant="muted">
                      {issue.shortId} · {issue.culprit}
                    </Text>
                  </Stack>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Tag variant={issue.reportedBy === 'Extension' ? 'promotion' : 'info'}>
                    {issue.reportedBy}
                  </Tag>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Text tabular>{formatCount(issue.count)}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text size="sm">{issue.firstSeen}</Text>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
          </IssuesTable>
        </Stack>
        <Stack gap="md">
          <SectionTitle
            actions={
              <Button size="xs" onClick={() => goTo('dependencies')}>
                {t('Dependencies')}
              </Button>
            }
          >
            {t('Triggered by')}
          </SectionTitle>
          {fn.triggers.map(trigger => (
            <Container key={trigger.source} border="primary" radius="md" padding="md lg">
              <Stack gap="xs">
                <Flex justify="between" align="center">
                  <Text bold>{trigger.label}</Text>
                  <Tag variant="muted">{`faas.trigger=${trigger.faasTrigger}`}</Tag>
                </Flex>
                <Text monospace size="sm">
                  {trigger.source}
                </Text>
                {trigger.kind === 'sqs' && (
                  <Link
                    to={`/organizations/${organization.slug}/insights/backend/queues/`}
                  >
                    {t('Open orders-queue in Queues')}
                  </Link>
                )}
                {trigger.kind === 'api-gateway' && (
                  <Text size="sm" variant="muted">
                    {t(
                      'Routes: GET /orders/{id}, GET /cart, POST /checkout, POST /orders/{id}/pay'
                    )}
                  </Text>
                )}
                {trigger.kind === 'durable' && (
                  <Text size="sm" variant="muted">
                    {t(
                      'One trace per durable execution (trace ID from the execution ARN); replayed steps are marked.'
                    )}
                  </Text>
                )}
              </Stack>
            </Container>
          ))}
        </Stack>
      </Grid>
    </Stack>
  );
}

function DependenciesTab({
  fn,
  window,
  organization,
}: {
  fn: LambdaFunction;
  organization: Organization;
  window: TimeWindow;
}) {
  const t0 = totals([fn], window);
  const deps = dependencies(fn);
  const upstream = deps.filter(d => d.kind === 'trigger');
  const downstream = deps.filter(d => d.kind === 'downstream');
  return (
    <Stack gap="xl" paddingTop="lg">
      <Container border="primary" radius="md" padding="lg">
        <ServiceMap
          nodes={[
            ...upstream.map(d => ({
              id: d.label,
              column: 0 as const,
              label: d.label,
              sublabel: d.op,
              variant: 'neutral' as const,
            })),
            {
              id: fn.name,
              column: 1,
              label: fn.name,
              sublabel: `${formatCount(t0.invocations)} invocations · p95 ${formatMs(t0.p95)}`,
              variant: health(fn, t0),
            },
            ...downstream.map(d => ({
              id: d.label,
              column: 2 as const,
              label: d.label,
              sublabel: `${d.op} · p95 ${formatMs(d.p95Ms)}`,
              variant: d.errorRate > 0.02 ? ('critical' as const) : ('neutral' as const),
            })),
          ]}
          edges={[
            ...upstream.map(d => ({
              from: d.label,
              to: fn.name,
              weight: 4,
              label: `${formatCount(t0.invocations)} invocations`,
            })),
            ...downstream.map(d => ({
              from: fn.name,
              to: d.label,
              weight: 1 + 4 * d.shareOfDuration,
              label: `${formatPct(d.shareOfDuration, 0)} of duration`,
              variant: d.errorRate > 0.02 ? ('danger' as const) : ('neutral' as const),
            })),
          ]}
        />
      </Container>
      <Stack gap="md">
        <SectionTitle source="spans">{t('Downstream calls')}</SectionTitle>
        <DepsTable>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell>{t('Resource')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Operation')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Calls')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Per invocation')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('p95')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Errors')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Share of duration')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{null}</SimpleTable.HeaderCell>
          </SimpleTable.Header>
          {downstream
            .slice()
            .sort((a, b) => b.shareOfDuration - a.shareOfDuration)
            .map(dep => (
              <SimpleTable.Row key={dep.label}>
                <SimpleTable.RowCell>
                  <Text bold>{dep.label}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text monospace size="sm">
                    {dep.op}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Text tabular>
                    {formatCount(t0.invocations * dep.callsPerInvocation)}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Text tabular>{dep.callsPerInvocation.toFixed(1)}</Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Text
                    tabular
                    variant={dep.p95Ms > fn.timeoutS * 400 ? 'danger' : undefined}
                  >
                    {formatMs(dep.p95Ms)}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Text tabular variant={dep.errorRate > 0.02 ? 'danger' : undefined}>
                    {formatPct(dep.errorRate, 1)}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <ShareBar ratio={dep.shareOfDuration} />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <LinkButton
                    size="xs"
                    to={exploreUrl(
                      organization,
                      `faas.name:${fn.name} span.op:${dep.op}`
                    )}
                  >
                    {t('Spans')}
                  </LinkButton>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
        </DepsTable>
      </Stack>
    </Stack>
  );
}

function ShareBar({ratio}: {ratio: number}) {
  return (
    <Flex gap="sm" align="center" width="100%">
      <ShareTrack>
        <ShareFill style={{width: `${ratio * 100}%`}} />
      </ShareTrack>
      <Text size="sm" tabular>
        {formatPct(ratio, 0)}
      </Text>
    </Flex>
  );
}

function ConfigurationTab({fn}: {fn: LambdaFunction}) {
  const status = STATUS_LABELS[fn.instrumentation];
  const kind = fn.triggers[0]!.kind;
  const rows: Array<[string, React.ReactNode]> = [
    [t('Runtime'), `${fn.runtime} (${fn.arch})`],
    [
      t('Handler'),
      <Text monospace key="handler">
        {fn.instrumentation === 'drift'
          ? fn.handler
          : `sentry_sdk…sentry_lambda_handler → ${fn.handler}`}
      </Text>,
    ],
    [t('Memory / timeout'), `${fn.memoryMb} MB / ${fn.timeoutS}s`],
    [
      t('Concurrency'),
      fn.reservedConcurrency
        ? t('reserved %s', fn.reservedConcurrency)
        : fn.provisionedConcurrency
          ? t('provisioned %s', fn.provisionedConcurrency)
          : t('unreserved'),
    ],
    [t('Account / region'), `${fn.account} / ${fn.region}`],
    [t('Owner'), `team:${fn.team}`],
    [t('Sentry SDK layer'), fn.sdkLayer ?? t('missing')],
    [t('Sentry extension layer'), fn.extensionLayer ?? t('missing')],
    [
      t('Instrumentation'),
      <Tag key="status" variant={status.variant}>
        {status.label}
      </Tag>,
    ],
  ];
  if (kind === 'sqs' || kind === 'dynamodb') {
    rows.push(
      [
        t('Event source mapping'),
        kind === 'sqs'
          ? 'orders-queue · batch size 10 · window 0s'
          : 'inventory stream · batch size 100 · LATEST',
      ],
      [
        t('Retries / bisect'),
        kind === 'sqs' ? (
          'redrive after 5 receives → orders-dlq'
        ) : (
          <Text key="retries" variant="danger">
            {t('unlimited retries, bisect off')}
          </Text>
        ),
      ],
      [t('Partial batch response'), kind === 'sqs' ? 'ReportBatchItemFailures' : t('off')]
    );
  }
  return (
    <Stack gap="xl" paddingTop="lg">
      <Grid columns={{xs: '1fr', lg: '1fr 1fr'}} gap="xl">
        <Container border="primary" radius="md" overflow="hidden">
          {rows.map(([label, value]) => (
            <ConfigRow key={label}>
              <Text variant="muted" size="sm">
                {label}
              </Text>
              <Text size="sm">{value}</Text>
            </ConfigRow>
          ))}
        </Container>
        <Stack gap="md">
          <SectionTitle source="aws">{t('Environment set by Sentry')}</SectionTitle>
          <CodeBlock language="bash" hideCopyButton>
            {`SENTRY_DSN=https://••••@o4511773493493760.ingest.de.sentry.io/4512089988857936
SENTRY_INITIAL_HANDLER=${fn.handler}
SENTRY_TRACES_SAMPLE_RATE=0.2
SENTRY_RELEASE=${releaseAt(fn, Date.now()).release}
SENTRY_ENVIRONMENT=${fn.env}`}
          </CodeBlock>
          {fn.instrumentation === 'drift' && (
            <Container border="danger" radius="md" padding="lg">
              <Stack gap="sm">
                <Text bold variant="danger">
                  {t('Drift detected 3 hours ago')}
                </Text>
                <Text size="sm">
                  {t(
                    'A CloudFormation deploy (inventory-stack) replaced the layers and environment. The rule env:production still matches, so remote instrumentation restores it on the next sync.'
                  )}
                </Text>
                <Flex>
                  <ReinstrumentButton name={fn.name} label={t('Re-instrument now')} />
                </Flex>
              </Stack>
            </Container>
          )}
          {fn.instrumentation === 'manual' && (
            <Text size="sm" variant="muted">
              {t(
                'Instrumented by hand with an older SDK layer and no extension: no timeout, OOM or platform metrics. Switch it to a rule to manage it remotely.'
              )}
            </Text>
          )}
        </Stack>
      </Grid>
    </Stack>
  );
}

const IssuesTable = styled(SimpleTable)`
  grid-template-columns: minmax(0, 1fr) max-content max-content max-content;
`;

const DepsTable = styled(SimpleTable)`
  grid-template-columns: minmax(0, 1.5fr) max-content repeat(4, max-content) minmax(
      140px,
      1fr
    ) max-content;
`;

const ConfigRow = styled('div')`
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const ShareTrack = styled('div')`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: ${p => p.theme.tokens.background.tertiary};
  overflow: hidden;
`;

const ShareFill = styled('div')`
  height: 100%;
  background: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

function tabBadge(key: string, fn: LambdaFunction, t0: ReturnType<typeof totals>) {
  if (key === 'invocations' && t0.timeouts + t0.oom > 0) {
    return <Badge variant="danger">{formatCount(t0.timeouts + t0.oom)}</Badge>;
  }
  if (
    key === 'cost' &&
    (t0.memory / fn.memoryMb >= 0.95 || t0.memory / fn.memoryMb < 0.25)
  ) {
    return <Badge variant="warning">{formatPct(t0.memory / fn.memoryMb, 0)}</Badge>;
  }
  if (key === 'cold-starts' && coldStartRate(t0) > 0.025) {
    return <Badge variant="muted">{formatPct(coldStartRate(t0), 1)}</Badge>;
  }
  if (
    key === 'configuration' &&
    (fn.instrumentation === 'drift' || DEPRECATED_RUNTIMES.has(fn.runtime))
  ) {
    return <Badge variant="warning">!</Badge>;
  }
  return null;
}

function FunctionSwitcher({current}: {current: LambdaFunction}) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <CompactSelect
      search
      value={current.name}
      options={FUNCTIONS.map(fn => ({
        value: fn.name,
        label: fn.name,
        details: `${fn.triggers[0]!.label} · team:${fn.team}`,
      }))}
      onChange={option =>
        navigate({
          ...location,
          query: {
            ...location.query,
            name: option.value,
            invocation: undefined,
            sel: undefined,
          },
        })
      }
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} size="sm" variant="transparent">
          <Text size="lg" bold>
            {current.name}
          </Text>
        </OverlayTrigger.Button>
      )}
    />
  );
}

const HEALTH_TAG = {
  critical: {variant: 'danger', label: t('Critical')},
  warning: {variant: 'warning', label: t('Needs attention')},
  healthy: {variant: 'success', label: t('Healthy')},
} as const;

function FunctionHeader({
  fn,
  window,
  refresh,
}: {
  fn: LambdaFunction;
  refresh: React.ReactNode;
  window: TimeWindow;
}) {
  const t0 = totals([fn], window);
  const state = health(fn, t0);
  const top = insightsFor(fn, window)[0];
  const release = releaseAt(fn, window.end);
  const deployedHours = (Date.now() - release.deployedAt) / 3_600_000;
  const status = STATUS_LABELS[fn.instrumentation];
  const trigger = fn.triggers[0]!;
  const facts: Array<[string, React.ReactNode]> = [
    [
      t('Trigger'),
      <Fragment key="trigger">
        <Text bold>{trigger.label}</Text> <Text variant="muted">{trigger.source}</Text>
      </Fragment>,
    ],
    [t('Runtime'), `${fn.runtime} · ${fn.arch}`],
    [t('Memory'), `${fn.memoryMb} MB`],
    [t('Timeout'), `${fn.timeoutS}s`],
    [
      t('Concurrency'),
      fn.reservedConcurrency
        ? t('%s reserved', fn.reservedConcurrency)
        : fn.provisionedConcurrency
          ? t('%s provisioned', fn.provisionedConcurrency)
          : t('unreserved'),
    ],
    [
      t('Release'),
      <Fragment key="release">
        <Text monospace>{release.release}</Text>{' '}
        <Text variant="muted">
          {t(
            'v%s · %s ago',
            release.version,
            deployedHours < 48
              ? `${Math.round(deployedHours)}h`
              : `${Math.round(deployedHours / 24)}d`
          )}
        </Text>
      </Fragment>,
    ],
    [t('Owner'), `team:${fn.team}`],
    [
      t('Sentry'),
      <Tag key="status" variant={status.variant}>
        {status.label}
      </Tag>,
    ],
  ];
  return (
    <Container border="primary" radius="md" padding="lg xl" background="primary">
      <Stack gap="md">
        <Flex justify="between" align="center" gap="md" wrap="wrap">
          <Flex gap="sm" align="center" minWidth="0">
            <Tag variant={HEALTH_TAG[state].variant}>{HEALTH_TAG[state].label}</Tag>
            {fn.durable && <Tag variant="promotion">{t('Durable function')}</Tag>}
            <Text size="md" ellipsis>
              {top
                ? top.title
                : t(
                    '%s invocations, p95 %s, %s failed in this period.',
                    formatCount(t0.invocations),
                    formatMs(t0.p95),
                    formatPct(failureRate(t0), 2)
                  )}
            </Text>
          </Flex>
          <Flex gap="sm" align="center">
            <PageFilterBar>
              <DatePageFilter />
            </PageFilterBar>
            {refresh}
          </Flex>
        </Flex>
        <FactGrid>
          {facts.map(([label, value]) => (
            <Stack key={label} gap="0" minWidth="0">
              <Text size="xs" variant="muted" uppercase>
                {label}
              </Text>
              <Text size="sm" ellipsis>
                {value}
              </Text>
            </Stack>
          ))}
        </FactGrid>
      </Stack>
    </Container>
  );
}

const FactGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;
