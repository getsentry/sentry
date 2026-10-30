import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button, ButtonBar, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {InfoText} from '@sentry/scraps/info';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  type ModalRenderProps,
  openInsightChartModal,
  openModal,
} from 'sentry/actionCreators/modal';
import type {
  ChartXRangeSelectionProps,
  SelectionCallbackParams,
} from 'sentry/components/charts/useChartXRangeSelection';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {updateDateTime} from 'sentry/components/pageFilters/actions';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {
  IconArrow,
  IconChevron,
  IconDownload,
  IconEllipsis,
  IconExpand,
  IconFire,
  IconInfo,
  IconRefresh,
  IconSearch,
  IconTable,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getFormattedDate, getUtcDateString} from 'sentry/utils/dates';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {ContinuousTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/continuousTimeSeries';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Histogram, Sparkline} from 'sentry/views/insights/awsLambda/charts';
import {
  FACETS,
  REFRESH_OPTIONS,
  refreshNow,
  useLambdaWindow,
  useNow,
  useUrlListState,
  useUrlState,
} from 'sentry/views/insights/awsLambda/hooks';
import {
  chartReleases,
  DATA_SOURCE_LABELS,
  type DataSource,
  FUNCTIONS,
  type Health,
  type Insight,
  type InvocationStatus,
  type LambdaFunction,
  type MockSpan,
  previousWindow,
  type TimeWindow,
} from 'sentry/views/insights/awsLambda/mockData';
import {mockActions, useMockStore} from 'sentry/views/insights/awsLambda/mockStore';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

export const AWS_LAMBDA_BASE_PATH = 'aws-lambda';

export function lambdaUrl(organization: Organization, path = '') {
  return normalizeUrl(
    `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${AWS_LAMBDA_BASE_PATH}/${path}`
  );
}

export function functionUrl(
  organization: Organization,
  name: string,
  timeQuery: Record<string, unknown> = {},
  extra: Record<string, string | undefined> = {}
) {
  return {
    pathname: lambdaUrl(organization, 'function/'),
    query: {...timeQuery, name, ...extra},
  };
}

export function exploreUrl(organization: Organization, query: string) {
  return {
    pathname: normalizeUrl(`/organizations/${organization.slug}/explore/traces/`),
    query: {query},
  };
}

// Formatting

export function formatCount(value: number) {
  return value < 1000
    ? String(Math.round(value))
    : formatAbbreviatedNumber(Math.round(value));
}

export function formatPct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatMs(ms: number) {
  if (ms >= 60_000) {
    return `${(ms / 60_000).toFixed(1)}min`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

export function formatUsd(value: number) {
  return value >= 100 ? `$${Math.round(value).toLocaleString()}` : `$${value.toFixed(2)}`;
}

// Small pieces

const SOURCE_DESCRIPTIONS: Record<DataSource, string> = {
  extension:
    'Unsampled platform data from the Sentry Lambda extension (Lambda Telemetry API).',
  spans: 'From function.aws spans sent by the SDK. Sampled; counts are extrapolated.',
  logs: 'Function output collected by the extension (Telemetry API) and SDK logging records.',
  integration:
    'CloudWatch metrics pulled by the AWS integration, for data the extension can’t see.',
  aws: 'Function configuration, read by the AWS integration.',
};

/** Where a number comes from: quiet text, the detail is in the tooltip. */
export function SourceTag({source}: {source: DataSource}) {
  return (
    <InfoText title={SOURCE_DESCRIPTIONS[source]} size="xs" variant="muted">
      {t('via %s', DATA_SOURCE_LABELS[source])}
    </InfoText>
  );
}

export function MockBadge() {
  return (
    <Tooltip
      title={t(
        'Prototype with generated data from static/app/views/insights/awsLambda/mockData.ts'
      )}
    >
      <Tag variant="promotion">{t('Mock data')}</Tag>
    </Tooltip>
  );
}

/** Semantic colours, so a failure looks the same in every chart. */
export function useSeriesColors() {
  const theme = useTheme();
  return {
    invocations: theme.tokens.graphics.accent.vibrant,
    errors: theme.tokens.graphics.danger.vibrant,
    timeouts: theme.tokens.graphics.warning.vibrant,
    oom: theme.tokens.graphics.promotion.vibrant,
    throttles: theme.tokens.graphics.neutral.moderate,
    limit: theme.tokens.graphics.danger.moderate,
    secondary: theme.tokens.graphics.neutral.vibrant,
  };
}

const HEALTH_LABELS: Record<Health, string> = {
  critical: 'Critical',
  warning: 'Warning',
  healthy: 'Healthy',
};

export function HealthDot({health}: {health: Health}) {
  return (
    <Tooltip title={HEALTH_LABELS[health]}>
      <Dot health={health} aria-label={HEALTH_LABELS[health]} />
    </Tooltip>
  );
}

const Dot = styled('span')<{health: Health}>`
  display: inline-block;
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${p =>
    p.health === 'critical'
      ? p.theme.tokens.graphics.danger.vibrant
      : p.health === 'warning'
        ? p.theme.tokens.graphics.warning.vibrant
        : p.theme.tokens.graphics.success.vibrant};
`;

export function TriggerTags({fn}: {fn: LambdaFunction}) {
  return (
    <Flex gap="xs" wrap="wrap">
      {fn.triggers.map(trigger => (
        <Tooltip
          key={trigger.source}
          title={`${trigger.source} · faas.trigger=${trigger.faasTrigger}`}
        >
          <Tag variant="muted">{trigger.label}</Tag>
        </Tooltip>
      ))}
    </Flex>
  );
}

export function MemoryBar({used, limit}: {limit: number; used: number}) {
  const ratio = Math.min(1, used / limit);
  const variant = ratio >= 0.95 ? 'danger' : ratio <= 0.25 ? 'warning' : 'normal';
  return (
    <Tooltip title={`Max memory used ${Math.round(used)} MB of ${limit} MB`}>
      <Stack gap="xs" width="100%">
        <Text size="sm" tabular wrap="nowrap">
          {Math.round(used)}
          <Text size="xs" variant="muted">
            {` / ${limit} MB`}
          </Text>
        </Text>
        <BarTrack>
          <BarFill ratio={ratio} variant={variant} />
        </BarTrack>
      </Stack>
    </Tooltip>
  );
}

const BarTrack = styled('div')`
  height: 4px;
  width: 100%;
  border-radius: 2px;
  background: ${p => p.theme.tokens.background.tertiary};
  overflow: hidden;
`;

const BarFill = styled('div')<{ratio: number; variant: 'danger' | 'warning' | 'normal'}>`
  height: 100%;
  width: ${p => p.ratio * 100}%;
  background: ${p =>
    p.variant === 'danger'
      ? p.theme.tokens.graphics.danger.vibrant
      : p.variant === 'warning'
        ? p.theme.tokens.graphics.warning.vibrant
        : p.theme.tokens.graphics.accent.vibrant};
`;

export function StatusTag({status}: {status: InvocationStatus}) {
  switch (status) {
    case 'timeout':
      return <Tag variant="danger">{t('Timeout')}</Tag>;
    case 'oom':
      return <Tag variant="danger">{t('Out of memory')}</Tag>;
    case 'error':
      return <Tag variant="warning">{t('Error')}</Tag>;
    case 'throttled':
      return <Tag variant="muted">{t('Throttled')}</Tag>;
    default:
      return <Tag variant="success">{t('OK')}</Tag>;
  }
}

// KPI tiles with sparkline and change vs the previous period

export function Kpi({
  label,
  value,
  previous,
  current,
  series,
  detail,
  polarity = 'lower',
  variant,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  current?: number;
  detail?: React.ReactNode;
  onClick?: () => void;
  /** Whether lower (default) or higher values are better. */
  polarity?: 'lower' | 'higher' | 'neutral';
  previous?: number;
  series?: Array<number | null>;
  variant?: 'danger' | 'warning' | 'success';
}) {
  const change =
    current !== undefined && previous ? (current - previous) / previous : undefined;
  const worse =
    change === undefined || polarity === 'neutral'
      ? null
      : polarity === 'lower'
        ? change > 0.05
        : change < -0.05;
  const better =
    change === undefined || polarity === 'neutral'
      ? null
      : polarity === 'lower'
        ? change < -0.05
        : change > 0.05;
  return (
    <KpiTile clickable={!!onClick} onClick={onClick}>
      <Stack gap="xs">
        <Text variant="muted" size="sm" ellipsis>
          {label}
        </Text>
        <Flex justify="between" align="baseline" gap="sm">
          <Text size="xl" bold wrap="nowrap">
            {value}
          </Text>
          {change !== undefined &&
            Number.isFinite(change) &&
            Math.abs(change) >= 0.005 && (
              <Tooltip title={t('Compared with the previous period')}>
                <Flex align="center" gap="2xs">
                  <IconArrow
                    direction={change > 0 ? 'up' : 'down'}
                    size="xs"
                    variant={worse ? 'danger' : better ? 'success' : 'muted'}
                  />
                  <Text
                    size="xs"
                    tabular
                    variant={worse ? 'danger' : better ? 'success' : 'muted'}
                  >
                    {Math.abs(change) >= 10 ? '>999%' : formatPct(Math.abs(change), 0)}
                  </Text>
                </Flex>
              </Tooltip>
            )}
        </Flex>
        <SparkWrap>
          {series ? (
            <Sparkline
              fluid
              values={series}
              height={24}
              variant={
                variant === 'danger'
                  ? 'danger'
                  : variant === 'warning'
                    ? 'warning'
                    : 'accent'
              }
            />
          ) : null}
        </SparkWrap>
        <Text size="xs" variant="muted" ellipsis>
          {detail}
        </Text>
      </Stack>
    </KpiTile>
  );
}

const SparkWrap = styled('div')`
  height: 24px;
  width: 100%;
`;

const KpiTile = styled('div')<{clickable: boolean}>`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  background: ${p => p.theme.tokens.background.primary};
  cursor: ${p => (p.clickable ? 'pointer' : 'default')};
  transition: border-color 0.1s;

  &:hover {
    border-color: ${p =>
      p.clickable ? p.theme.tokens.border.accent : p.theme.tokens.border.primary};
  }
`;

export function KpiRow({children}: {children: React.ReactNode}) {
  return (
    <Grid columns="repeat(auto-fit, minmax(170px, 1fr))" gap="sm">
      {children}
    </Grid>
  );
}

// Insights

const SEVERITY_ICON = {
  danger: <IconFire size="sm" variant="danger" />,
  warning: <IconWarning size="sm" variant="warning" />,
  info: <IconInfo size="sm" variant="accent" />,
};

/** Compact, expandable list of insights with their fix and a jump into the right view. */
export function InsightCards({
  insights,
  organization,
  timeQuery,
  showFunction = true,
  emptyMessage,
  limit,
  expandFirst = true,
}: {
  insights: Insight[];
  organization: Organization;
  timeQuery: Record<string, unknown>;
  emptyMessage?: string;
  expandFirst?: boolean;
  /** Show this many, with a button for the rest. */
  limit?: number;
  showFunction?: boolean;
}) {
  const {snoozed} = useMockStore();
  const now = Date.now();
  const snoozedInsights = insights.filter(insight => (snoozed[insight.id] ?? 0) > now);
  const active = insights.filter(insight => (snoozed[insight.id] ?? 0) <= now);
  const [showAll, setShowAll] = useState(false);
  const visible = limit && !showAll ? active.slice(0, limit) : active;
  const [expanded, setExpanded] = useState(expandFirst ? (visible[0]?.id ?? null) : null);
  if (!visible.length) {
    return (
      <Container border="primary" radius="md" padding="lg xl">
        <Stack gap="xs">
          <Text variant="muted">
            {emptyMessage ?? t('Nothing needs attention in this time range.')}
          </Text>
          {snoozedInsights.length > 0 && <SnoozedNote insights={snoozedInsights} />}
        </Stack>
      </Container>
    );
  }
  return (
    <Feed>
      {visible.map(insight => {
        const open = expanded === insight.id;
        return (
          <FeedRow key={insight.id} severity={insight.severity} open={open}>
            <FeedHeader
              onClick={() => setExpanded(open ? null : insight.id)}
              aria-expanded={open}
            >
              {SEVERITY_ICON[insight.severity]}
              <Flex gap="md" align="baseline" minWidth="0" flex="1">
                {showFunction && (
                  <FunctionName size="sm" bold>
                    {insight.functionName}
                  </FunctionName>
                )}
                <Text size="sm" bold={open} {...(open ? {} : {ellipsis: true as const})}>
                  {insight.title}
                </Text>
              </Flex>
              <IconChevron direction={open ? 'up' : 'down'} size="xs" />
            </FeedHeader>
            {open && (
              <Stack gap="sm" paddingLeft="3xl" paddingBottom="md" paddingRight="md">
                <Text size="sm" variant="muted">
                  {insight.detail}
                </Text>
                <Text size="sm">
                  <Text bold size="sm">
                    {t('Fix: ')}
                  </Text>
                  {insight.fix}
                </Text>
                <Flex gap="sm" align="center">
                  <LinkButton
                    size="xs"
                    variant="primary"
                    to={functionUrl(organization, insight.functionName, timeQuery, {
                      tab: insight.investigate.tab,
                      ...insight.investigate.query,
                    })}
                  >
                    {t('Investigate')}
                  </LinkButton>
                  <Button
                    size="xs"
                    onClick={() =>
                      openCreateMonitor({
                        name: `${insight.functionName}: ${insight.title.split(':')[0]}`,
                        query: monitorQueryFor(insight),
                        scope: insight.functionName,
                      })
                    }
                  >
                    {t('Create monitor')}
                  </Button>
                  <Button
                    size="xs"
                    variant="transparent"
                    onClick={() => {
                      mockActions.snooze(insight.id, Date.now() + 24 * 3_600_000);
                      addSuccessMessage(t('Snoozed for 24 hours: %s', insight.title));
                    }}
                  >
                    {t('Snooze 24h')}
                  </Button>
                  <Flex flex="1" justify="end">
                    <SourceTag source={insight.source} />
                  </Flex>
                </Flex>
              </Stack>
            )}
          </FeedRow>
        );
      })}
      {(snoozedInsights.length > 0 || visible.length < active.length) && (
        <Flex padding="xs md" gap="md" align="center">
          {visible.length < active.length && (
            <Button size="zero" variant="link" onClick={() => setShowAll(true)}>
              {t('Show %s more', active.length - visible.length)}
            </Button>
          )}
          {snoozedInsights.length > 0 && <SnoozedNote insights={snoozedInsights} />}
        </Flex>
      )}
    </Feed>
  );
}

function SnoozedNote({insights}: {insights: Insight[]}) {
  return (
    <Flex gap="xs" align="center">
      <Text size="xs" variant="muted">
        {t('%s snoozed', insights.length)}
      </Text>
      <Button
        size="zero"
        variant="link"
        onClick={() => insights.forEach(insight => mockActions.unsnooze(insight.id))}
      >
        {t('Undo')}
      </Button>
    </Flex>
  );
}

function monitorQueryFor(insight: Insight) {
  const scope = `faas.name:${insight.functionName}`;
  if (insight.id.endsWith('timeouts')) {
    return `sum(aws.lambda.timeouts){${scope}} > 0`;
  }
  if (insight.id.endsWith('oom')) {
    return `sum(aws.lambda.out_of_memory){${scope}} > 0`;
  }
  if (insight.id.endsWith('throttles')) {
    return `sum(aws.lambda.throttles){${scope}} > 0`;
  }
  if (insight.id.endsWith('iterator')) {
    return `max(aws.lambda.iterator_age){${scope}} > 5m`;
  }
  return `failure_rate(span.op:function.aws ${scope}) > 0.01`;
}

const FunctionName = styled(Text)`
  flex-shrink: 0;
  min-width: 150px;
`;

const Feed = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  overflow: hidden;
`;

const FeedRow = styled('div')<{open: boolean; severity: Insight['severity']}>`
  border-left: 3px solid
    ${p =>
      p.severity === 'danger'
        ? p.theme.tokens.graphics.danger.vibrant
        : p.severity === 'warning'
          ? p.theme.tokens.graphics.warning.vibrant
          : p.theme.tokens.graphics.accent.vibrant};
  background: ${p => (p.open ? p.theme.tokens.background.secondary : 'transparent')};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const FeedHeader = styled('button')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  width: 100%;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const REFRESH_LABELS: Record<number, string> = {
  10: '10s',
  30: '30s',
  60: '1m',
  300: '5m',
};

/** Auto-refresh interval with a manual refresh button, like CloudWatch and Grafana. */
export function RefreshControl({
  refresh,
  setRefresh,
  canRefresh,
}: {
  canRefresh: boolean;
  refresh: number | null;
  setRefresh: (seconds: number | null) => void;
}) {
  return (
    <ButtonBar>
      <Button
        size="sm"
        icon={<IconRefresh />}
        aria-label={t('Refresh now')}
        tooltipProps={{title: t('Refresh now')}}
        onClick={refreshNow}
      />
      <CompactSelect
        value={refresh ?? 0}
        disabled={!canRefresh}
        menuTitle={t('Auto-refresh')}
        options={[
          {value: 0, label: t('Off')},
          ...REFRESH_OPTIONS.map(seconds => ({
            value: seconds,
            label: t('Every %s', REFRESH_LABELS[seconds]),
            details:
              seconds === 10 ? t('Live: the time range keeps ending now') : undefined,
          })),
        ]}
        onChange={option => setRefresh(option.value || null)}
        trigger={triggerProps => (
          <Tooltip
            title={t(
              'Auto-refresh needs a relative time range. Zooming in sets an absolute one.'
            )}
            disabled={canRefresh}
          >
            <OverlayTrigger.Button
              {...triggerProps}
              size="sm"
              icon={<LiveDot live={!!refresh} />}
            >
              {refresh ? t('Live · %s', REFRESH_LABELS[refresh]) : t('Auto-refresh off')}
            </OverlayTrigger.Button>
          </Tooltip>
        )}
      />
    </ButtonBar>
  );
}

const LiveDot = styled('span')<{live: boolean}>`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p =>
    p.live
      ? p.theme.tokens.graphics.success.vibrant
      : p.theme.tokens.graphics.neutral.moderate};
  animation: ${p => (p.live ? 'lambda-pulse 1.6s ease-in-out infinite' : 'none')};

  @keyframes lambda-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
`;

// Charts

export type DurationStat = 'p50' | 'p75' | 'p90' | 'p95' | 'p99' | 'maxDuration';

export const DURATION_STATS: Array<{label: string; value: DurationStat}> = [
  {value: 'p50', label: 'p50'},
  {value: 'p75', label: 'p75'},
  {value: 'p90', label: 'p90'},
  {value: 'p95', label: 'p95'},
  {value: 'p99', label: 'p99'},
  {value: 'maxDuration', label: 'max'},
];

export const STAT_LABEL = Object.fromEntries(
  DURATION_STATS.map(stat => [stat.value, stat.label])
) as Record<DurationStat, string>;

/** Each percentile keeps its colour whichever ones are picked (fixed palette order). */
export function useStatColors(): Record<DurationStat, string> {
  const theme = useTheme();
  const palette = theme.chart.getColorPalette(DURATION_STATS.length - 1);
  return Object.fromEntries(
    DURATION_STATS.map((stat, i) => [stat.value, palette[i % palette.length]!])
  ) as Record<DurationStat, string>;
}

const referenceLines = new WeakSet<Plottable>();

/** A limit such as the timeout: drawn, but left out of the previous-period comparison. */
export function limitLine(series: TimeSeries, alias: string, color: string) {
  const line = new Line(series, {alias, color});
  referenceLines.add(line);
  return line;
}

type ChartPlottables = (window: TimeWindow, stats: DurationStat[]) => Plottable[];

interface ChartWidgetProps {
  /** Builds the series for a window, so fullscreen and comparisons can re-run it. */
  plottables: ChartPlottables;
  source: DataSource;
  title: string;
  window: TimeWindow;
  actions?: React.ReactNode;
  description?: string;
  /** The chart has its own range (e.g. a 14-day trend) instead of the page's. */
  fixedWindow?: boolean;
  height?: number;
  /** One line under the chart that says what to take away from it. */
  note?: React.ReactNode;
  /** Opens the invocations behind a dragged time range. */
  onShowInvocations?: (range: [number, number]) => void;
  /** Functions whose deploys are drawn as release lines. */
  releasesFor?: LambdaFunction[];
  /** Duration percentiles shown first; enables the percentile picker. */
  stats?: DurationStat[];
  /** Controls shown in place of the title, e.g. a metric picker that names the chart. */
  titleControls?: React.ReactNode;
}

interface ChartState {
  compare: boolean;
  setCompare: (compare: boolean) => void;
  setStats: (stats: DurationStat[]) => void;
  stats: DurationStat[];
}

function useChartPlottables(
  props: ChartWidgetProps,
  window: TimeWindow,
  {stats, compare}: ChartState
) {
  const theme = useTheme();
  const {version} = useMockStore();
  return useMemo(
    () => {
      const current = props.plottables(window, stats);
      // Clicking a bar or point opens the invocations in that bucket.
      const {onShowInvocations} = props;
      if (onShowInvocations) {
        for (const plottable of current) {
          if (
            plottable instanceof ContinuousTimeSeries &&
            !referenceLines.has(plottable)
          ) {
            const {values, meta} = plottable.timeSeries;
            (plottable as Plottable).onClick = dataIndex => {
              const start = values[Math.min(dataIndex, values.length - 1)]?.timestamp;
              if (start !== undefined) {
                onShowInvocations([start, start + meta.interval]);
              }
            };
          }
        }
      }
      if (!compare) {
        return current;
      }
      const shift = window.end - window.start;
      return [
        ...current,
        ...previousPeriod(
          props.plottables(previousWindow(window), stats),
          shift,
          theme.tokens.graphics.neutral.moderate
        ),
      ];
    },
    // `plottables` is a new closure every render; the window and options describe it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [window, stats, compare, version, theme]
  );
}

/** The same series one period earlier, shifted onto the current one. Stacked bars compare as their total. */
function previousPeriod(
  plottables: Plottable[],
  shift: number,
  color: string
): Plottable[] {
  const series = plottables.filter(
    (p): p is ContinuousTimeSeries =>
      p instanceof ContinuousTimeSeries && !referenceLines.has(p)
  );
  const shifted = (timeSeries: TimeSeries): TimeSeries => ({
    ...timeSeries,
    values: timeSeries.values.map(v => ({
      ...v,
      timestamp: v.timestamp + shift,
      incomplete: false,
    })),
  });
  if (series.length > 1 && series.every(p => p instanceof Bars)) {
    const first = series[0]!.timeSeries;
    const total: TimeSeries = {
      ...first,
      values: first.values.map((v, i) => ({
        ...v,
        value: series.every(p => p.timeSeries.values[i]?.value === null)
          ? null
          : series.reduce((sum, p) => sum + (p.timeSeries.values[i]?.value ?? 0), 0),
      })),
    };
    return [
      new Line(shifted(total), {
        alias: t('total, previous period'),
        name: 'previous-total',
        color,
      }),
    ];
  }
  return series.map(
    p =>
      new Line(shifted(p.timeSeries), {
        alias: t('%s, previous period', p.label),
        name: `previous-${p.name}`,
        color,
      })
  );
}

/** Drag across a chart to zoom in or open the invocations in that range, like Explore. */
function useRangeSelection(
  onShowInvocations?: (range: [number, number]) => void
): Partial<ChartXRangeSelectionProps> {
  return {
    disabled: false,
    onInsideSelectionClick: params => {
      if (params.selectionState) {
        params.setSelectionState({...params.selectionState, isActionMenuVisible: true});
      }
    },
    onOutsideSelectionClick: params => {
      if (params.selectionState?.isActionMenuVisible) {
        params.setSelectionState({...params.selectionState, isActionMenuVisible: false});
      }
    },
    actionMenuRenderer: params => (
      <RangeMenu params={params} onShowInvocations={onShowInvocations} />
    ),
  };
}

function RangeMenu({
  params,
  onShowInvocations,
}: {
  params: SelectionCallbackParams;
  onShowInvocations?: (range: [number, number]) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [from, to] = params.selectionState?.selection.range ?? [0, 0];
  const start = Math.floor(from / 60_000) * 60_000;
  const end = Math.max(start + 60_000, Math.ceil(to / 60_000) * 60_000);
  return (
    <RangeMenuList>
      <RangeMenuHeader>
        {getFormattedDate(start, 'MMM D HH:mm')} – {getFormattedDate(end, 'HH:mm')}
      </RangeMenuHeader>
      <RangeMenuItem
        onClick={() => {
          updateDateTime(
            {start: getUtcDateString(start), end: getUtcDateString(end)},
            location,
            navigate,
            {save: true}
          );
          params.clearSelection();
        }}
      >
        {t('Zoom in')}
      </RangeMenuItem>
      {onShowInvocations && (
        <RangeMenuItem
          onClick={() => {
            onShowInvocations([start, end]);
            params.clearSelection();
          }}
        >
          {t('Show invocations and what’s different')}
        </RangeMenuItem>
      )}
      <RangeMenuItem onClick={params.clearSelection}>
        {t('Clear selection')}
      </RangeMenuItem>
    </RangeMenuList>
  );
}

const RangeMenuList = styled('ul')`
  list-style: none;
  margin: 0 !important;
  padding: 0;
  min-width: 220px;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  box-shadow: ${p => p.theme.shadow.medium};
  overflow: hidden;
  transform: translateY(-20px);
`;

const RangeMenuHeader = styled('li')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.content.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  font-variant-numeric: tabular-nums;
`;

const RangeMenuItem = styled('li')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  font-size: ${p => p.theme.font.size.sm};
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }
`;

function useChartState(initial: {compare?: boolean; stats?: DurationStat[]}): ChartState {
  const [stats, setStats] = useState(initial.stats ?? []);
  const [compare, setCompare] = useState(initial.compare ?? false);
  return {stats, setStats, compare, setCompare};
}

function ChartToolbar({
  props,
  state,
  plottables,
  window,
  onFullscreen,
}: {
  plottables: Plottable[];
  props: ChartWidgetProps;
  state: ChartState;
  window: TimeWindow;
  onFullscreen?: (showData: boolean) => void;
}) {
  return (
    <Widget.WidgetToolbar>
      {props.actions}
      {props.stats && <StatPicker state={state} />}
      <DropdownMenu
        size="sm"
        position="bottom-end"
        triggerProps={{
          'aria-label': t('Chart actions'),
          size: 'xs',
          variant: 'transparent',
          showChevron: false,
          icon: <IconEllipsis size="xs" />,
        }}
        items={[
          {
            key: 'compare',
            label: state.compare
              ? t('Hide previous period')
              : t('Compare to previous period'),
            details: t('Overlays the same series one period earlier'),
            onAction: () => state.setCompare(!state.compare),
          },
          ...(onFullscreen
            ? [{key: 'data', label: t('View data'), onAction: () => onFullscreen(true)}]
            : []),
          {
            key: 'csv',
            label: t('Download CSV'),
            onAction: () => downloadCsv(props.title, window, plottables),
          },
        ]}
      />
      {onFullscreen && (
        <Button
          size="xs"
          variant="transparent"
          icon={<IconExpand size="xs" />}
          aria-label={t('Open full screen')}
          tooltipProps={{title: t('Full screen')}}
          onClick={() => onFullscreen(false)}
        />
      )}
      <Widget.WidgetDescription
        title={props.title}
        description={`${props.description ? `${props.description} ` : ''}${DATA_SOURCE_LABELS[props.source]}: ${SOURCE_DESCRIPTIONS[props.source]}`}
      />
    </Widget.WidgetToolbar>
  );
}

function StatPicker({state}: {state: ChartState}) {
  return (
    <CompactSelect
      multiple
      value={state.stats}
      menuTitle={t('Percentiles')}
      options={DURATION_STATS}
      onChange={selected =>
        state.setStats(
          selected.length
            ? DURATION_STATS.map(stat => stat.value).filter(stat =>
                selected.some(option => option.value === stat)
              )
            : state.stats
        )
      }
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} size="xs">
          {state.stats.map(stat => STAT_LABEL[stat]).join(', ')}
        </OverlayTrigger.Button>
      )}
    />
  );
}

/**
 * Every chart: drag to zoom or drill into invocations, a shared crosshair (WidgetSyncContext),
 * percentiles, previous-period overlay, full screen with the data table, and CSV export.
 */
export function ChartWidget(props: ChartWidgetProps) {
  const {height = 240, note, window, fixedWindow, onShowInvocations, releasesFor} = props;
  const state = useChartState({stats: props.stats});
  const plottables = useChartPlottables(props, window, state);
  const rangeSelection = useRangeSelection(onShowInvocations);
  const releases = releasesFor ? chartReleases(releasesFor, window) : undefined;
  const fullscreen = (showData: boolean) =>
    openInsightChartModal({
      title: props.title,
      fullscreen: true,
      children: (
        <FullscreenChart
          {...props}
          initial={{stats: state.stats, compare: state.compare}}
          showData={showData}
        />
      ),
    });

  return (
    <Widget
      height={height + (note ? 28 : 0)}
      Title={props.titleControls ?? <Widget.WidgetTitle title={props.title} />}
      Actions={
        <ChartToolbar
          props={props}
          state={state}
          plottables={plottables}
          window={window}
          onFullscreen={fullscreen}
        />
      }
      revealActions="always"
      Visualization={
        <TimeSeriesWidgetVisualization
          plottables={plottables}
          releases={releases}
          showReleaseAs="line"
          chartXRangeSelection={fixedWindow ? undefined : rangeSelection}
        />
      }
      Footer={
        note ? (
          <Text size="xs" variant="muted" ellipsis>
            {note}
          </Text>
        ) : undefined
      }
    />
  );
}

/** Full-screen view: follows the page's time range and refresh, with the time picker and the raw data. */
function FullscreenChart(
  props: ChartWidgetProps & {
    initial: {compare: boolean; stats: DurationStat[]};
    showData: boolean;
  }
) {
  const page = useLambdaWindow();
  const window = props.fixedWindow ? props.window : page.window;
  const state = useChartState(props.initial);
  const plottables = useChartPlottables(props, window, state);
  const rangeSelection = useRangeSelection(props.onShowInvocations);
  const [showData, setShowData] = useState(props.showData);
  const releases = props.releasesFor
    ? chartReleases(props.releasesFor, window)
    : undefined;

  return (
    <FullscreenBody>
      <Flex gap="sm" align="center" wrap="wrap">
        {!props.fixedWindow && (
          <Fragment>
            <PageFilterBar>
              <DatePageFilter />
            </PageFilterBar>
            <RefreshControl
              refresh={page.refresh}
              setRefresh={page.setRefresh}
              canRefresh={page.canRefresh}
            />
          </Fragment>
        )}
        {props.stats && <StatPicker state={state} />}
        <Button
          size="sm"
          onClick={() => state.setCompare(!state.compare)}
          variant={state.compare ? 'primary' : 'secondary'}
        >
          {t('Compare to previous period')}
        </Button>
        <Flex flex="1" justify="end" gap="sm">
          <Button
            size="sm"
            icon={<IconTable />}
            onClick={() => setShowData(!showData)}
            variant={showData ? 'primary' : 'secondary'}
          >
            {showData ? t('Hide data') : t('View data')}
          </Button>
          <Button
            size="sm"
            icon={<IconDownload />}
            onClick={() => downloadCsv(props.title, window, plottables)}
          >
            {t('CSV')}
          </Button>
        </Flex>
      </Flex>
      <FullscreenPlot withData={showData}>
        <TimeSeriesWidgetVisualization
          plottables={plottables}
          releases={releases}
          showReleaseAs="line"
          chartXRangeSelection={props.fixedWindow ? undefined : rangeSelection}
        />
      </FullscreenPlot>
      {props.note && (
        <Text size="sm" variant="muted">
          {props.note}
        </Text>
      )}
      {showData && <DataTable plottables={plottables} window={window} />}
    </FullscreenBody>
  );
}

// Below the modal header; with the data table open the chart keeps 40% and the table scrolls.
const FullscreenBody = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  height: calc(100vh - 240px);
`;

const FullscreenPlot = styled('div')<{withData: boolean}>`
  flex: ${p => (p.withData ? '0 0 40%' : '1')};
  min-height: 240px;
  position: relative;
`;

/** Rows of [timestamp, value per series], newest first; the in-progress bucket is marked. */
function tabulate(plottables: Plottable[]) {
  const series = plottables.filter(
    (p): p is ContinuousTimeSeries => p instanceof ContinuousTimeSeries
  );
  const timestamps = [
    ...new Set(series.flatMap(p => p.timeSeries.values.map(v => v.timestamp))),
  ].sort((a, b) => b - a);
  const byTimestamp = series.map(
    p => new Map(p.timeSeries.values.map(v => [v.timestamp, v]))
  );
  return {
    series,
    rows: timestamps.map(timestamp => ({
      timestamp,
      incomplete: byTimestamp.some(map => map.get(timestamp)?.incomplete),
      values: byTimestamp.map(map => map.get(timestamp)?.value ?? null),
    })),
  };
}

function formatSeriesValue(value: number | null, series: ContinuousTimeSeries) {
  if (value === null) {
    return '—';
  }
  switch (series.timeSeries.meta.valueType) {
    case 'duration':
      return formatMs(value);
    case 'percentage':
      return formatPct(value, 2);
    case 'currency':
      return `$${value.toFixed(4)}`;
    case 'size':
      return `${Math.round(value)} MB`;
    default:
      return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
}

function DataTable({plottables, window}: {plottables: Plottable[]; window: TimeWindow}) {
  const {series, rows} = tabulate(plottables);
  return (
    <DataTableScroll>
      <DataGrid columns={series.length}>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell>
            {t('Bucket start (%s)', formatInterval(window.interval))}
          </SimpleTable.HeaderCell>
          {series.map(p => (
            <SimpleTable.HeaderCell key={p.name}>{p.label}</SimpleTable.HeaderCell>
          ))}
        </SimpleTable.Header>
        {rows
          .filter(row => row.values.some(value => value !== null))
          .map(row => (
            <SimpleTable.Row key={row.timestamp}>
              <SimpleTable.RowCell>
                <Text size="sm" tabular>
                  {getFormattedDate(row.timestamp, 'MMM D HH:mm')}
                  {row.incomplete && (
                    <Text size="xs" variant="muted">
                      {` ${t('partial')}`}
                    </Text>
                  )}
                </Text>
              </SimpleTable.RowCell>
              {row.values.map((value, i) => (
                <SimpleTable.RowCell key={series[i]!.name} justify="end">
                  <Text size="sm" tabular>
                    {formatSeriesValue(value, series[i]!)}
                  </Text>
                </SimpleTable.RowCell>
              ))}
            </SimpleTable.Row>
          ))}
      </DataGrid>
    </DataTableScroll>
  );
}

const DataTableScroll = styled('div')`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const DataGrid = styled(SimpleTable)<{columns: number}>`
  grid-template-columns: max-content repeat(${p => p.columns}, minmax(110px, 1fr));
`;

function formatInterval(interval: number) {
  return interval >= 3_600_000 ? `${interval / 3_600_000}h` : `${interval / 60_000}m`;
}

function downloadCsv(title: string, window: TimeWindow, plottables: Plottable[]) {
  const {series, rows} = tabulate(plottables);
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = [
    ['timestamp', ...series.map(p => p.label), 'partial'].map(escape).join(','),
    ...rows
      .slice()
      .reverse()
      .map(row =>
        [
          new Date(row.timestamp).toISOString(),
          ...row.values.map(value => (value === null ? '' : String(value))),
          row.incomplete ? 'true' : '',
        ].join(',')
      ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/csv'}));
  downloadFromHref(
    `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date(window.start).toISOString().slice(0, 16)}.csv`,
    url
  );
  URL.revokeObjectURL(url);
}

// Distributions

export interface DistributionBin {
  count: number;
  from: number;
  to: number;
  highlight?: boolean;
}

interface DistributionWidgetProps {
  bins: DistributionBin[];
  formatX: (value: number) => string;
  source: DataSource;
  title: string;
  emptyMessage?: string;
  footer?: React.ReactNode;
  formatY?: (value: number) => string;
  markers?: Array<{
    label: string;
    value: number;
    variant: 'danger' | 'warning' | 'accent';
  }>;
  unit?: string;
}

/** A histogram in the same frame as the time-series charts: full screen, the bins as a table, CSV. */
export function DistributionWidget(props: DistributionWidgetProps) {
  const {bins, title, source, footer, emptyMessage} = props;
  const fullscreen = (showData: boolean) =>
    openInsightChartModal({
      title,
      fullscreen: true,
      children: <DistributionFullscreen {...props} showData={showData} />,
    });
  return (
    <Container border="primary" radius="md" padding="md lg">
      <Stack gap="sm">
        <Flex justify="between" align="center" gap="sm">
          <SectionTitle source={source}>{title}</SectionTitle>
          {bins.length > 0 && (
            <Flex gap="2xs" align="center">
              <DropdownMenu
                size="sm"
                position="bottom-end"
                triggerProps={{
                  'aria-label': t('Chart actions'),
                  size: 'xs',
                  variant: 'transparent',
                  showChevron: false,
                  icon: <IconEllipsis size="xs" />,
                }}
                items={[
                  {key: 'data', label: t('View data'), onAction: () => fullscreen(true)},
                  {
                    key: 'csv',
                    label: t('Download CSV'),
                    onAction: () => downloadBinsCsv(title, bins),
                  },
                ]}
              />
              <Button
                size="xs"
                variant="transparent"
                icon={<IconExpand size="xs" />}
                aria-label={t('Open full screen')}
                tooltipProps={{title: t('Full screen')}}
                onClick={() => fullscreen(false)}
              />
            </Flex>
          )}
        </Flex>
        {bins.length ? (
          <Histogram {...props} />
        ) : (
          <Text variant="muted">{emptyMessage ?? t('No data in this time range.')}</Text>
        )}
        {footer}
      </Stack>
    </Container>
  );
}

function DistributionFullscreen(props: DistributionWidgetProps & {showData: boolean}) {
  const [showData, setShowData] = useState(props.showData);
  const {
    bins,
    formatX,
    formatY = (value: number) => Math.round(value).toLocaleString(),
    unit = 'invocations',
  } = props;
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  return (
    <FullscreenBody>
      <Flex gap="sm" justify="end">
        <Button
          size="sm"
          icon={<IconTable />}
          onClick={() => setShowData(!showData)}
          variant={showData ? 'primary' : 'secondary'}
        >
          {showData ? t('Hide data') : t('View data')}
        </Button>
        <Button
          size="sm"
          icon={<IconDownload />}
          onClick={() => downloadBinsCsv(props.title, bins)}
        >
          {t('CSV')}
        </Button>
      </Flex>
      <Histogram
        {...props}
        height={Math.round(
          document.documentElement.clientHeight * (showData ? 0.32 : 0.6)
        )}
      />
      {props.footer}
      {showData && (
        <DataTableScroll>
          <BinGrid>
            <SimpleTable.Header>
              <SimpleTable.HeaderCell>{t('From')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('To')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{unit}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Share')}</SimpleTable.HeaderCell>
            </SimpleTable.Header>
            {bins.map(bin => (
              <SimpleTable.Row key={bin.from}>
                <SimpleTable.RowCell>
                  <Text size="sm" tabular>
                    {formatX(bin.from)}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Text size="sm" tabular>
                    {formatX(bin.to)}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Text size="sm" tabular>
                    {formatY(bin.count)}
                  </Text>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">
                  <Text size="sm" tabular variant="muted">
                    {formatPct(total ? bin.count / total : 0)}
                  </Text>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
          </BinGrid>
        </DataTableScroll>
      )}
    </FullscreenBody>
  );
}

const BinGrid = styled(SimpleTable)`
  grid-template-columns: repeat(4, minmax(110px, 1fr));
`;

function downloadBinsCsv(title: string, bins: DistributionBin[]) {
  const lines = [
    'from,to,count',
    ...bins.map(bin => `${bin.from},${bin.to},${bin.count}`),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/csv'}));
  downloadFromHref(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, url);
  URL.revokeObjectURL(url);
}

// Filter bar shared by the overview

export function FilterBar({refresh}: {refresh: React.ReactNode}) {
  const [search, setSearch] = useUrlState('q');
  const inputRef = useRef<HTMLInputElement>(null);

  // Shift+F focuses the search, like Dash0.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key === 'F' &&
        event.shiftKey &&
        !['INPUT', 'TEXTAREA'].includes(target?.tagName ?? '')
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <Flex gap="sm" align="center" wrap="wrap">
      <PageFilterBar>
        <ProjectPageFilter />
        <DatePageFilter />
      </PageFilterBar>
      <SearchWrapper>
        <SearchIcon>
          <IconSearch size="xs" />
        </SearchIcon>
        <Input
          ref={inputRef}
          size="sm"
          placeholder={t('Search functions (Shift+F)')}
          defaultValue={search ?? ''}
          onChange={event => setSearch(event.target.value)}
        />
      </SearchWrapper>
      {FACETS.map(facet => (
        <FacetSelect
          key={facet.key}
          facetKey={facet.key}
          label={facet.label}
          options={[...new Set(FUNCTIONS.map(fn => facet.value(fn)))]}
        />
      ))}
      <FacetSelect
        facetKey="health"
        label={t('Health')}
        options={['critical', 'warning', 'healthy']}
      />
      {refresh}
    </Flex>
  );
}

function FacetSelect({
  facetKey,
  label,
  options,
}: {
  facetKey: string;
  label: string;
  options: string[];
}) {
  const [values, setValues] = useUrlListState(facetKey);
  return (
    <CompactSelect
      multiple
      clearable
      value={values}
      options={options.map(option => ({value: option, label: option}))}
      onChange={selected => setValues(selected.map(option => String(option.value)))}
      menuTitle={label}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          size="sm"
          prefix={values.length ? label : undefined}
        >
          {values.length ? triggerProps.children : label}
        </OverlayTrigger.Button>
      )}
    />
  );
}

const SearchWrapper = styled('div')`
  position: relative;
  min-width: 220px;
  flex: 1;
  max-width: 340px;

  input {
    padding-left: 28px;
  }
`;

const SearchIcon = styled('div')`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  color: ${p => p.theme.tokens.content.secondary};
  pointer-events: none;
`;

export function windowLabel(window: TimeWindow) {
  const hours = (window.end - window.start) / 3_600_000;
  return hours >= 48
    ? t('last %s days', Math.round(hours / 24))
    : hours >= 1
      ? t('last %s hours', Math.round(hours))
      : t('last %s minutes', Math.round(hours * 60));
}

// Trace waterfall for one invocation

export function TraceWaterfall({spans}: {spans: MockSpan[]}) {
  const end = Math.max(...spans.map(span => span.startMs + span.durationMs));
  return (
    <Container border="primary" radius="md" overflow="hidden">
      {spans
        .slice()
        .sort((a, b) => a.startMs - b.startMs || a.depth - b.depth)
        .map((span, index) => (
          <WaterfallRow key={`${span.op}-${span.description}-${index}`}>
            <SpanLabel depth={span.depth}>
              <Flex gap="xs" align="center" minWidth="0">
                <Text size="xs" bold monospace>
                  {span.op}
                </Text>
                <Text size="xs" ellipsis>
                  {span.description}
                </Text>
              </Flex>
              {span.note && (
                <Text size="xs" variant="muted" ellipsis>
                  {span.note}
                </Text>
              )}
            </SpanLabel>
            <Track>
              <SpanBar
                status={span.status ?? 'ok'}
                left={(span.startMs / end) * 100}
                width={Math.max(0.4, (span.durationMs / end) * 100)}
              />
            </Track>
            <Text
              size="xs"
              tabular
              align="right"
              variant={span.status && span.status !== 'ok' ? 'danger' : undefined}
            >
              {formatMs(span.durationMs)}
              {span.status === 'unfinished' ? ' …' : ''}
            </Text>
          </WaterfallRow>
        ))}
    </Container>
  );
}

const WaterfallRow = styled('div')`
  display: grid;
  grid-template-columns: minmax(200px, 2fr) 3fr 64px;
  gap: ${p => p.theme.space.md};
  align-items: center;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const SpanLabel = styled('div')<{depth: number}>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-left: ${p => p.depth * 14}px;
`;

const Track = styled('div')`
  position: relative;
  height: 12px;
`;

const SpanBar = styled('div')<{
  left: number;
  status: NonNullable<MockSpan['status']>;
  width: number;
}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${p => p.left}%;
  width: ${p => p.width}%;
  border-radius: 2px;
  background: ${p =>
    p.status === 'ok'
      ? p.theme.tokens.graphics.accent.vibrant
      : p.status === 'unfinished'
        ? p.theme.tokens.graphics.warning.vibrant
        : p.theme.tokens.graphics.danger.vibrant};
  opacity: ${p => (p.status === 'unfinished' ? 0.6 : 1)};
`;

export function SectionTitle({
  children,
  source,
  actions,
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  source?: DataSource;
}) {
  return (
    <Flex justify="between" align="center" gap="md" wrap="wrap">
      <Flex gap="sm" align="center">
        <Text size="lg" bold>
          {children}
        </Text>
        {source && <SourceTag source={source} />}
      </Flex>
      {actions && <Fragment>{actions}</Fragment>}
    </Flex>
  );
}

/** Thin indeterminate bar shown while mock data is "fetching". */
export function LoadingBar({active}: {active: boolean}) {
  return <BarTrackTop aria-hidden>{active && <BarRunner />}</BarTrackTop>;
}

const BarTrackTop = styled('div')`
  position: relative;
  height: 2px;
  overflow: hidden;
`;

const BarRunner = styled('div')`
  position: absolute;
  top: 0;
  height: 100%;
  width: 30%;
  background: ${p => p.theme.tokens.graphics.accent.vibrant};
  animation: lambda-loading 1s ease-in-out infinite;

  @keyframes lambda-loading {
    from {
      left: -30%;
    }
    to {
      left: 100%;
    }
  }
`;

/** Dims content while newer data loads, so stale numbers are recognizable. */
export const Refreshing = styled('div')<{active: boolean}>`
  opacity: ${p => (p.active ? 0.55 : 1)};
  transition: opacity 0.2s ease;
`;

export function UpdatedAgo({at}: {at: number}) {
  const now = useNow();
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  return (
    <Text size="xs" variant="muted" tabular>
      {seconds < 5
        ? t('Updated just now')
        : seconds < 60
          ? t('Updated %ss ago', seconds)
          : t('Updated %sm ago', Math.round(seconds / 60))}
    </Text>
  );
}

export function KpiSkeletonRow({count = 8}: {count?: number}) {
  return (
    <KpiRow>
      {Array.from({length: count}, (_, i) => (
        <Placeholder key={i} height="96px" />
      ))}
    </KpiRow>
  );
}

interface MonitorDraft {
  name: string;
  query: string;
  scope: string;
}

export function openCreateMonitor(draft: MonitorDraft) {
  openModal(props => <CreateMonitorModal {...props} draft={draft} />);
}

function CreateMonitorModal({
  Header,
  Body,
  Footer,
  closeModal,
  draft,
}: ModalRenderProps & {draft: MonitorDraft}) {
  const [name, setName] = useState(draft.name);
  const [query, setQuery] = useState(draft.query);
  const [notify, setNotify] = useState('#alerts-checkout');
  return (
    <Fragment>
      <Header closeButton>
        <Text size="lg" bold>
          {t('Create monitor')}
        </Text>
      </Header>
      <Body>
        <Stack gap="md">
          <Stack gap="xs">
            <Text size="sm" bold>
              {t('Name')}
            </Text>
            <Input value={name} onChange={event => setName(event.target.value)} />
          </Stack>
          <Stack gap="xs">
            <Text size="sm" bold>
              {t('Condition')}
            </Text>
            <MonoInput value={query} onChange={event => setQuery(event.target.value)} />
            <Text size="xs" variant="muted">
              {t(
                'Evaluated every minute on the same data as this page. Scope: %s',
                draft.scope
              )}
            </Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" bold>
              {t('Notify')}
            </Text>
            <CompactSelect
              value={notify}
              options={[
                {value: '#alerts-checkout', label: 'Slack #alerts-checkout'},
                {value: '#oncall', label: 'Slack #oncall'},
                {value: 'pagerduty', label: 'PagerDuty: Checkout on-call'},
                {value: 'email', label: t('Email the owning team')},
              ]}
              onChange={option => setNotify(option.value)}
            />
          </Stack>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="sm" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            onClick={() => {
              mockActions.createMonitor({name, query, scope: draft.scope, notify});
              closeModal();
              addSuccessMessage(t('Monitor “%s” created', name));
            }}
          >
            {t('Create monitor')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

const MonoInput = styled(Input)`
  font-family: ${p => p.theme.font.family.mono};
`;

/** Confirm, then apply a memory size through the (mock) AWS integration. */
export function openApplyMemory(fn: LambdaFunction, memoryMb: number) {
  openModal(({Header, Body, Footer, closeModal}) => (
    <Fragment>
      <Header closeButton>
        <Text size="lg" bold>
          {t('Change memory of %s', fn.name)}
        </Text>
      </Header>
      <Body>
        <Stack gap="sm">
          <Text>{t('%s MB → %s MB', fn.memoryMb, memoryMb)}</Text>
          <Text size="sm" variant="muted">
            {t(
              'Sentry updates the function configuration through the AWS integration and Lambda publishes a new version. Your next infrastructure deploy may revert it, so also change it in your template:'
            )}
          </Text>
          <CodeSnippet>{`MemorySize: ${memoryMb}  # ${fn.name}`}</CodeSnippet>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="sm" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            onClick={() => {
              mockActions.setMemory(fn.name, memoryMb, fn.memoryMb);
              closeModal();
              addSuccessMessage(
                t(
                  '%s now runs with %s MB. A marker was added to its charts.',
                  fn.name,
                  memoryMb
                )
              );
            }}
          >
            {t('Apply %s MB', memoryMb)}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  ));
}

const CodeSnippet = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

/** Button that re-adds the Sentry layers to a function, with a short pending state. */
export function ReinstrumentButton({name, label}: {name: string; label?: string}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="xs"
      busy={pending}
      disabled={pending}
      onClick={() => {
        setPending(true);
        setTimeout(() => {
          mockActions.setInstrumentation(name, 'rule');
          setPending(false);
          addSuccessMessage(
            t('%s is instrumented again (SDK layer 312, extension 4).', name)
          );
        }, 1400);
      }}
    >
      {pending ? t('Updating layers…') : (label ?? t('Re-instrument'))}
    </Button>
  );
}
