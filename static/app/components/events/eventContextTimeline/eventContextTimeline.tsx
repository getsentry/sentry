import type {ReactNode} from 'react';
import {Fragment, memo, useCallback, useEffect, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import type {LocationDescriptor} from 'history';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {getEnhancedBreadcrumbs} from 'sentry/components/events/breadcrumbs/utils';
import {focusEventContextRows} from 'sentry/components/events/eventContextTimeline/eventContextFocus';
import {useMetricsIssueSection} from 'sentry/components/events/metrics/useMetricsIssueSection';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {getTraceTimeRangeFromEvent} from 'sentry/components/quickTrace/utils';
import {t, tn} from 'sentry/locale';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {getTitle} from 'sentry/utils/events';
import type {TagVariant} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {
  LogsPageDataProvider,
  useLogsPageDataQueryResult,
} from 'sentry/views/explore/contexts/logs/logsPageData';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogRowTimestampMillis} from 'sentry/views/explore/logs/utils';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {USER_SESSIONS_SUB_PATH} from 'sentry/views/explore/usersessions/settings';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/context';
import {SectionDivider} from 'sentry/views/issueDetails/foldSection';
import {TraceViewMetricsProviderWrapper} from 'sentry/views/performance/newTraceDetails/traceMetrics';
import {getTraceTargetFromEvent} from 'sentry/views/performance/traceDetails/traceTarget';

type LaneId = 'network' | 'interaction' | 'breadcrumbs' | 'issues' | 'logs' | 'metrics';

interface TimelineItem {
  color: string;
  key: string;
  lane: LaneId;
  source: 'breadcrumb' | 'trace' | 'log' | 'metric' | 'event';
  timestamp: number;
  title: string;
  isCurrentEvent?: boolean;
  /**
   * Severity of the item, used to color its tooltip tag (purple by default, red for
   * errors, orange for warnings). The lane conveys *what kind* of thing it is; the
   * level conveys *how severe*, independent of lane.
   */
  level?: string;
  subtitle?: string;
  target?: {section: SectionKey; id?: string};
  to?: LocationDescriptor;
}

/**
 * A stretch of the timeline. Idle segments are drawn at a fixed width regardless of
 * how long they actually lasted.
 */
interface Segment {
  endFraction: number;
  endTime: number;
  isIdle: boolean;
  startFraction: number;
  startTime: number;
}

/** Subset of the Discover `events` response we place on the timeline. */
interface TraceEvent {
  culprit: string;
  id: string;
  'issue.id': number;
  timestamp: string;
  title: string;
  transaction: string;
  'event.type'?: string;
}

/**
 * Everything else in the trace, so the timeline isn't limited to what this one
 * SDK happened to record as breadcrumbs.
 *
 * Only the DISCOVER dataset, so this covers errors and transactions but not
 * issue-platform occurrences (performance issues, rage clicks). Those need the second
 * ISSUE_PLATFORM query that `useTraceTimelineEvents` runs; until then the "Other Issues"
 * lane is errors-only.
 */
function useTraceDiscoverEvents(event: Event) {
  const organization = useOrganization();
  const traceId = event.contexts?.trace?.trace_id;
  const {start, end} = getTraceTimeRangeFromEvent(event);

  return useQuery({
    ...apiOptions.as<{data: TraceEvent[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.DISCOVER,
          field: [
            'title',
            'project',
            'timestamp',
            'issue.id',
            'transaction',
            'event.type',
            'culprit',
          ],
          per_page: 100,
          query: `trace:${traceId}`,
          referrer: 'api.issues.issue_events',
          sort: '-timestamp',
          start,
          end,
          project: ALL_ACCESS_PROJECTS,
        },
        staleTime: Infinity,
      }
    ),
    enabled: Boolean(traceId),
    retry: false,
  });
}

/** Content stays this far from either track edge, so nothing renders flush against it. */
export const EDGE_PAD = 0.04;
/**
 * Insets a scale fraction (0–1 of the compressed timeline) into the padded band the
 * track actually draws in. Markers, idle bands, the event line and the axis ticks all
 * go through here, so they stay on one coordinate system.
 */
const toDisplay = (fraction: number) => EDGE_PAD + fraction * (1 - 2 * EDGE_PAD);
/** Quiet stretches at least this long collapse into a fixed-width column. */
export const IDLE_GAP_THRESHOLD_MS = 4000;
/** Share of the axis each collapsed gap takes, so idle time can't crowd out real events. */
const IDLE_GAP_FRACTION = 0.07;
const MAX_TOTAL_IDLE_FRACTION = 0.4;
/** Where time marks sit along the axis, as fractions of the (compressed) timeline. */
export const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1];
const MAX_TOOLTIP_TITLE_LENGTH = 80;
const MAX_TOOLTIP_SUBTITLE_LENGTH = 240;
/**
 * Logs can be extremely high-volume, so the timeline shows only the most recent
 * handful to stay legible; the full set lives in the Logs section below. Metrics are
 * far fewer, so all fetched metrics are shown (clustering handles any bursts).
 */
export const MAX_TIMELINE_LOGS = 10;

function getSessionId(event: Event): string | undefined {
  return event.tags.find(tag => tag.key === 'session.id')?.value;
}

function parseTimestamp(timestamp?: string | null): number | null {
  if (!timestamp) {
    return null;
  }
  const milliseconds = Date.parse(timestamp);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function truncateTooltipText(value: string, maxLength: number): string {
  const text = stripAnsi(value).replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}

function getTimelineItemType(item: TimelineItem): string {
  if (item.source === 'log') {
    return item.title || t('Log');
  }

  switch (item.lane) {
    case 'issues':
      return t('Issue');
    case 'network':
      return t('Network');
    case 'interaction':
      return t('User activity');
    case 'metrics':
      return t('Metric');
    case 'breadcrumbs':
      return t('Breadcrumb');
    case 'logs':
      return t('Log');
    default:
      return t('Event');
  }
}

// The tag color tracks severity, not lane: purple is the resting state, and only an
// error (red) or warning (orange) level earns a specific hue. This mirrors how the
// markers themselves are colored, so the tag and the dot always agree.
function getTimelineItemVariant(item: TimelineItem): TagVariant {
  switch (item.level?.toLowerCase()) {
    case 'fatal':
    case 'critical':
    case 'error':
      return 'danger';
    case 'warn':
    case 'warning':
      return 'warning';
    default:
      return 'promotion';
  }
}

/** Max width shared by both tooltips so single and clustered popups line up. */
const TOOLTIP_MAX_WIDTH = '320px';

/** A colored type tag followed by the item's title, sitting on one line. */
function TimelineItemHeading({item}: {item: TimelineItem}) {
  const type = getTimelineItemType(item);
  const title = item.source === 'log' ? (item.subtitle ?? item.title) : item.title;

  return (
    <Flex gap="xs" align="center" wrap="wrap" width="100%">
      <Tag variant={getTimelineItemVariant(item)}>{type.toUpperCase()}</Tag>
      {title && (
        <Text size="sm" bold align="left" wordBreak="break-word">
          {truncateTooltipText(title, MAX_TOOLTIP_TITLE_LENGTH)}
        </Text>
      )}
    </Flex>
  );
}

function TimelineMarkerTooltip({item}: {item: TimelineItem}) {
  const subtitle = item.source === 'log' ? undefined : item.subtitle;

  return (
    <Stack gap="xs" align="start" maxWidth={TOOLTIP_MAX_WIDTH}>
      <TimelineItemHeading item={item} />
      {subtitle && (
        <Text size="sm" variant="muted" align="left" wordBreak="break-word">
          {truncateTooltipText(subtitle, MAX_TOOLTIP_SUBTITLE_LENGTH)}
        </Text>
      )}
    </Stack>
  );
}

/** How close two markers must be (as a fraction of the track) to merge into a cluster. */
const CLUSTER_THRESHOLD_FRACTION = 0.015;
/** How many items a cluster tooltip lists before collapsing the rest into a count. */
const MAX_CLUSTER_TOOLTIP_ITEMS = 6;

/** A run of markers close enough in time that they'd render on top of each other. */
interface MarkerCluster {
  items: TimelineItem[];
  /** Position of the cluster along the track, as a percentage (0–100). */
  left: number;
}

// Error beats warning beats everything else, so a cluster always advertises the
// worst thing hiding inside it.
function severityRank(level?: string): number {
  switch (level?.toLowerCase()) {
    case 'fatal':
    case 'critical':
    case 'error':
      return 2;
    case 'warn':
    case 'warning':
      return 1;
    default:
      return 0;
  }
}

/** The most severe item in a cluster — drives the cluster's color and click target. */
function clusterRepresentative(items: TimelineItem[]): TimelineItem {
  return items.reduce(
    (best, item) => (severityRank(item.level) > severityRank(best.level) ? item : best),
    items[0]!
  );
}

/**
 * Groups a lane's items into clusters by proximity along the track. Markers within
 * `CLUSTER_THRESHOLD_FRACTION` of a cluster's anchor merge into it, so simultaneous
 * events collapse into one count-badged marker instead of an unreadable pile.
 */
function clusterLaneItems(
  laneItems: TimelineItem[],
  toFraction: (timestamp: number) => number
): MarkerCluster[] {
  const positioned = laneItems
    .map(item => ({item, fraction: toFraction(item.timestamp)}))
    .sort((a, b) => a.fraction - b.fraction);

  const clusters: MarkerCluster[] = [];
  let current: Array<{fraction: number; item: TimelineItem}> = [];

  const flush = () => {
    if (current.length === 0) {
      return;
    }
    const meanFraction =
      current.reduce((total, entry) => total + entry.fraction, 0) / current.length;
    clusters.push({
      left: meanFraction * 100,
      items: current.map(entry => entry.item),
    });
    current = [];
  };

  positioned.forEach(entry => {
    const anchor = current[0]?.fraction;
    if (anchor === undefined || entry.fraction - anchor < CLUSTER_THRESHOLD_FRACTION) {
      current.push(entry);
    } else {
      flush();
      current.push(entry);
    }
  });
  flush();

  return clusters;
}

function TimelineClusterTooltip({items}: {items: TimelineItem[]}) {
  const shown = items.slice(0, MAX_CLUSTER_TOOLTIP_ITEMS);
  const remaining = items.length - shown.length;

  return (
    <Stack gap="sm" align="start" maxWidth={TOOLTIP_MAX_WIDTH}>
      <Text size="xs" variant="muted" align="left" uppercase>
        {tn('%s event', '%s events', items.length)}
      </Text>
      <Stack gap="xs" align="start" width="100%">
        {shown.map(item => (
          <TimelineItemHeading key={item.key} item={item} />
        ))}
      </Stack>
      {remaining > 0 && (
        <Text size="sm" variant="muted" align="left">
          {tn('and %s more event', 'and %s more events', remaining)}
        </Text>
      )}
    </Stack>
  );
}

/**
 * One row of the timeline: the lane's label plus its markers.
 *
 * Memoized because a lane can hold a hundred markers, each of which mounts a `Tooltip`
 * — and every `Tooltip` costs a hover-overlay hook and a portal even while closed. The
 * parent re-renders on any location change on the issue page; the lanes must not.
 */
const TimelineLane = memo(function TimelineLaneRow({
  label,
  hint,
  clusters,
  onActivateItem,
  onActivateCluster,
}: {
  clusters: MarkerCluster[];
  label: string;
  onActivateCluster: (items: TimelineItem[]) => void;
  onActivateItem: (item: TimelineItem) => void;
  hint?: string;
}) {
  return (
    <Fragment>
      <LaneLabel>
        <Text size="sm" variant="muted" ellipsis>
          {label}
        </Text>
        {hint && <InfoTip size="xs" title={hint} />}
      </LaneLabel>
      <LaneTrack>
        {clusters.map(cluster => {
          if (cluster.items.length === 1) {
            const item = cluster.items[0]!;
            const actionable = Boolean(item.target ?? item.to);
            return (
              <Tooltip
                key={item.key}
                title={<TimelineMarkerTooltip item={item} />}
                skipWrapper
              >
                <Marker
                  type="button"
                  aria-label={t('View %s details', item.title)}
                  markerColor={item.color}
                  left={cluster.left}
                  // Deliberately not `disabled`. A disabled button leaves the tab order
                  // and stops firing pointer events, so its tooltip becomes unreachable
                  // by mouse *and* keyboard — and a marker with nothing to open is still
                  // worth reading. Drop the handler instead and keep it hoverable.
                  actionable={actionable}
                  onClick={actionable ? () => onActivateItem(item) : undefined}
                />
              </Tooltip>
            );
          }

          const representative = clusterRepresentative(cluster.items);
          const actionable = Boolean(representative.target ?? representative.to);
          return (
            <Tooltip
              key={`cluster-${cluster.items[0]!.key}`}
              title={<TimelineClusterTooltip items={cluster.items} />}
              skipWrapper
            >
              <ClusterMarker
                type="button"
                aria-label={tn('View %s event', 'View %s events', cluster.items.length)}
                markerColor={representative.color}
                left={cluster.left}
                actionable={actionable}
                onClick={actionable ? () => onActivateCluster(cluster.items) : undefined}
              >
                {cluster.items.length}
              </ClusterMarker>
            </Tooltip>
          );
        })}
      </LaneTrack>
    </Fragment>
  );
});

// A breadcrumb's lane is its origin, not its severity: an errored fetch is a red
// dot in Network, an errored click a red dot in User Activity. Severity is carried
// by color alone (see `colorForLevel`), so error/warning crumbs are not pulled out
// into a lane of their own. Breadcrumbs collapse into three lanes — network I/O,
// user activity, and a catch-all — with everything else falling to the catch-all.
function laneForBreadcrumb(type?: BreadcrumbType): LaneId {
  switch (type) {
    case BreadcrumbType.HTTP:
    case BreadcrumbType.QUERY:
    case BreadcrumbType.NETWORK:
    case BreadcrumbType.CONNECTIVITY:
      return 'network';
    case BreadcrumbType.UI:
    case BreadcrumbType.USER:
    case BreadcrumbType.NAVIGATION:
      return 'interaction';
    default:
      return 'breadcrumbs';
  }
}

interface SeverityColors {
  /** Purple, for items with no meaningful severity (fetches, transactions, metrics, info logs…). */
  default: string;
  /** Red, for errors and fatals. */
  error: string;
  /** Orange, for warnings. */
  warning: string;
}

/**
 * Markers are colored by an item's own severity rather than by its lane: purple
 * is the baseline, and only a specific level (an error, a warning) earns a
 * specific hue. This way a warning log reads as a warning wherever it sits.
 */
function colorForLevel(level: string | null | undefined, colors: SeverityColors): string {
  switch (level?.toLowerCase()) {
    case 'fatal':
    case 'critical':
    case 'error':
      return colors.error;
    case 'warn':
    case 'warning':
      return colors.warning;
    default:
      return colors.default;
  }
}

function getBreadcrumbSubtitle(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const preferredKeys = ['url', 'to', 'from', 'method', 'status_code', 'reason'];
  const values = preferredKeys.flatMap(key => {
    const value = record[key];
    return typeof value === 'string' || typeof value === 'number'
      ? [`${key}: ${value}`]
      : [];
  });
  return values.length > 0 ? values.slice(0, 3).join(' · ') : undefined;
}

/**
 * A headline number in the timeline header, mirroring the stat tiles on the
 * Sessions detail page this component links into. `background="primary"` lifts
 * the tile off the secondary-surfaced header around it.
 */
function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Stack
      gap="2xs"
      padding="sm md"
      radius="md"
      border="primary"
      background="primary"
      minWidth="96px"
    >
      <Flex align="center" gap="xs">
        <Text size="xs" variant="muted">
          {label}
        </Text>
        {hint && <InfoTip size="xs" title={hint} />}
      </Flex>
      <Text size="lg" bold tabular>
        {value}
      </Text>
    </Stack>
  );
}

/**
 * Escape hatch out of the summary: the whole session if we know which one this event
 * belongs to, otherwise the whole trace.
 */
function FullContextButton({event, sessionId}: {event: Event; sessionId?: string}) {
  const organization = useOrganization();
  const location = useLocation();

  if (sessionId) {
    return (
      <LinkButton
        size="xs"
        to={{
          pathname: `/organizations/${organization.slug}/explore/${USER_SESSIONS_SUB_PATH}/${sessionId}/`,
        }}
      >
        {t('View Full Session')}
      </LinkButton>
    );
  }

  if (!event.contexts?.trace?.trace_id) {
    return null;
  }

  return (
    <LinkButton size="xs" to={getTraceTargetFromEvent(event, organization, location)}>
      {t('View Full Trace')}
    </LinkButton>
  );
}

/**
 * Splits the timeline into active and idle segments and assigns each a share of the
 * axis. Idle segments get a fixed share instead of a proportional one, so a 30 second
 * pause doesn't squeeze everything that actually happened into a few pixels.
 */
function buildScale(timestamps: number[], domainStart: number, domainEnd: number) {
  if (domainEnd <= domainStart) {
    return [];
  }

  const bounds: Array<Pick<Segment, 'endTime' | 'isIdle' | 'startTime'>> = [];
  let cursor = domainStart;
  timestamps.forEach((timestamp, index) => {
    const previous = timestamps[index - 1];
    if (previous === undefined || timestamp - previous < IDLE_GAP_THRESHOLD_MS) {
      return;
    }
    if (previous > cursor) {
      bounds.push({startTime: cursor, endTime: previous, isIdle: false});
    }
    bounds.push({startTime: previous, endTime: timestamp, isIdle: true});
    cursor = timestamp;
  });
  if (cursor < domainEnd) {
    bounds.push({startTime: cursor, endTime: domainEnd, isIdle: false});
  }

  const idleCount = bounds.filter(segment => segment.isIdle).length;
  const activeSegments = bounds.filter(segment => !segment.isIdle);
  const activeTotal = activeSegments.reduce(
    (total, segment) => total + (segment.endTime - segment.startTime),
    0
  );
  const totalIdleFraction = Math.min(
    idleCount * IDLE_GAP_FRACTION,
    MAX_TOTAL_IDLE_FRACTION
  );
  const idleFraction = idleCount === 0 ? 0 : totalIdleFraction / idleCount;
  const activeFraction = 1 - totalIdleFraction;

  let cursorFraction = 0;
  return bounds.map<Segment>(segment => {
    const size = segment.isIdle
      ? idleFraction
      : activeTotal > 0
        ? ((segment.endTime - segment.startTime) / activeTotal) * activeFraction
        : activeFraction / Math.max(activeSegments.length, 1);
    const startFraction = cursorFraction;
    cursorFraction = Math.min(1, cursorFraction + size);
    return {...segment, startFraction, endFraction: cursorFraction};
  });
}

/** Maps a fraction of the compressed timeline back to the instant it stands for. */
function scaleTimeAt(segments: Segment[], domainStart: number, fraction: number): number {
  if (segments.length === 0) {
    return domainStart;
  }
  const segment =
    segments.find(
      candidate =>
        fraction >= candidate.startFraction && fraction <= candidate.endFraction
    ) ?? segments.at(-1)!;
  const span = segment.endFraction - segment.startFraction;
  const ratio = span <= 0 ? 0 : (fraction - segment.startFraction) / span;
  return segment.startTime + ratio * (segment.endTime - segment.startTime);
}

/**
 * Where each time mark sits and what it reads.
 *
 * Ticks go through `toDisplay` like every marker does, so a tick labelled "0s" lands on
 * the same pixel as a marker at the start of the domain. Positioning them on the raw
 * scale instead put every label EDGE_PAD out of step with the data it described.
 */
export function getAxisTicks(
  segments: Segment[],
  domainStart: number
): Array<{elapsedSeconds: number; left: number}> {
  return AXIS_TICKS.map(fraction => ({
    left: toDisplay(fraction) * 100,
    elapsedSeconds: (scaleTimeAt(segments, domainStart, fraction) - domainStart) / 1000,
  }));
}

/**
 * A compressed, multi-lane view of everything we know happened around this error.
 *
 * Logs and metrics use the same trace-scoped providers and queries as their issue-details
 * sections. The timeline itself stays a plain component that merges their results.
 */
export function EventContextTimeline({event}: {event: Event}) {
  const organization = useOrganization();
  const traceId = event.contexts?.trace?.trace_id;
  const metricsEnabled = canUseMetricsUI(organization);

  if (!traceId) {
    return <EventContextTimelineContent event={event} logs={[]} metrics={[]} />;
  }

  const content = isLogsEnabled(organization) ? (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
      source="state"
      freeze={{traceId}}
    >
      <LogsPageDataProvider disabled={false} staleTime={EXPLORE_FIVE_MIN_STALE_TIME}>
        <EventContextTimelineWithLogs event={event} />
      </LogsPageDataProvider>
    </LogsQueryParamsProvider>
  ) : metricsEnabled ? (
    <EventContextTimelineWithMetrics event={event} logs={[]} />
  ) : (
    <EventContextTimelineContent event={event} logs={[]} metrics={[]} />
  );

  return metricsEnabled ? (
    <TraceViewMetricsProviderWrapper traceSlug={traceId}>
      {content}
    </TraceViewMetricsProviderWrapper>
  ) : (
    content
  );
}

function EventContextTimelineWithLogs({event}: {event: Event}) {
  const {data} = useLogsPageDataQueryResult();
  const organization = useOrganization();

  return canUseMetricsUI(organization) ? (
    <EventContextTimelineWithMetrics event={event} logs={data ?? []} />
  ) : (
    <EventContextTimelineContent event={event} logs={data ?? []} metrics={[]} />
  );
}

function EventContextTimelineWithMetrics({
  event,
  logs,
}: {
  event: Event;
  logs: OurLogsResponseItem[];
}) {
  const traceId = event.contexts?.trace?.trace_id ?? '';
  const {result} = useMetricsIssueSection({traceId});
  return (
    <EventContextTimelineContent event={event} logs={logs} metrics={result.data ?? []} />
  );
}

function EventContextTimelineContent({
  event,
  logs,
  metrics,
}: {
  event: Event;
  logs: OurLogsResponseItem[];
  metrics: Array<Record<string, string | number>>;
}) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const {navScrollMargin, dispatch} = useIssueDetails();
  const organization = useOrganization();
  const sessionId = getSessionId(event);
  const {data: traceResponse, isPending: isLoading} = useTraceDiscoverEvents(event);
  const traceEvents = traceResponse?.data;

  // Color conveys severity, not lane: purple is the baseline for anything
  // without a meaningful level, and only errors/warnings pick up a specific
  // hue. Drawn from the data-viz `graphics` tokens (tuned for shapes, unlike
  // `content.*` which is tuned for text).
  const severityColors = useMemo<SeverityColors>(
    () => ({
      default: theme.tokens.graphics.accent.vibrant,
      error: theme.tokens.graphics.danger.vibrant,
      warning: theme.tokens.graphics.warning.vibrant,
    }),
    [theme]
  );

  const eventTimestamp = parseTimestamp(event.dateCreated ?? event.dateReceived);
  // The focal event is colored by its own severity like everything else (a warning
  // reads orange, an error red), rather than being forced to the error hue.
  const eventLevel = event.tags?.find(tag => tag.key === 'level')?.value;
  const eventColor = colorForLevel(eventLevel, severityColors);

  const breadcrumbItems = useMemo<TimelineItem[]>(
    () =>
      getEnhancedBreadcrumbs(event, theme).flatMap((crumb, index) => {
        // Crumbs without `raw` are synthesized from the event itself, which already
        // has its own marker, and crumbs without a timestamp can't be placed.
        const timestamp = crumb.raw ? parseTimestamp(crumb.raw.timestamp) : null;
        if (timestamp === null) {
          return [];
        }
        const lane = laneForBreadcrumb(crumb.breadcrumb.type);
        // An error/warning breadcrumb keeps its severity color; the type also
        // implies a level for crumbs that don't carry one explicitly.
        const level =
          crumb.breadcrumb.type === BreadcrumbType.ERROR
            ? 'error'
            : crumb.breadcrumb.type === BreadcrumbType.WARNING
              ? 'warning'
              : crumb.breadcrumb.level;
        return [
          {
            key: `breadcrumb-${index}`,
            lane,
            timestamp,
            title: crumb.title,
            subtitle:
              crumb.breadcrumb.message ?? getBreadcrumbSubtitle(crumb.breadcrumb.data),
            color: colorForLevel(level, severityColors),
            level,
            source: 'breadcrumb' as const,
            target: {section: SectionKey.BREADCRUMBS},
          },
        ];
      }),
    [event, severityColors, theme]
  );

  // The error being viewed is on the timeline too, so it shows up in the list alongside
  // everything around it. Trace results skip it to avoid listing it twice.
  const eventItems = useMemo<TimelineItem[]>(() => {
    if (eventTimestamp === null) {
      return [];
    }
    const {title, subtitle} = getTitle(event);
    return [
      {
        key: `event-${event.id}`,
        lane: 'issues' as const,
        timestamp: eventTimestamp,
        title: title || event.title || event.message,
        subtitle: subtitle || event.culprit || undefined,
        color: eventColor,
        level: eventLevel,
        source: 'event' as const,
        isCurrentEvent: true,
      },
    ];
  }, [event, eventTimestamp, eventColor, eventLevel]);

  const traceItems = useMemo<TimelineItem[]>(
    () =>
      (traceEvents ?? []).flatMap(traceEvent => {
        const timestamp = parseTimestamp(traceEvent.timestamp);
        if (timestamp === null || traceEvent.id === event.id) {
          return [];
        }
        const isError = traceEvent['event.type'] === 'error';
        return [
          {
            key: `trace-${traceEvent.id}`,
            // Error trace events are *other* Sentry issues that link out to their own
            // pages; non-error trace events are server transactions, i.e. network I/O.
            lane: isError ? ('issues' as const) : ('network' as const),
            timestamp,
            title: traceEvent.title,
            subtitle: traceEvent.transaction || traceEvent.culprit || undefined,
            color: isError ? severityColors.error : severityColors.default,
            level: isError ? 'error' : undefined,
            source: 'trace' as const,
            // Errors link out to their own issue; a server transaction just scrolls
            // to the trace preview on this page.
            ...(isError
              ? {
                  to: {
                    pathname: `/organizations/${organization.slug}/issues/${traceEvent['issue.id']}/events/${traceEvent.id}/`,
                    query: {referrer: 'event-context-timeline'},
                  },
                }
              : {target: {section: SectionKey.TRACE}}),
          },
        ];
      }),
    [event.id, organization.slug, severityColors, traceEvents]
  );

  const logItems = useMemo<TimelineItem[]>(
    () =>
      logs.slice(0, MAX_TIMELINE_LOGS).flatMap(row => {
        const preciseTimestamp = getLogRowTimestampMillis(row);
        const timestamp = Number.isFinite(preciseTimestamp)
          ? preciseTimestamp
          : parseTimestamp(String(row[OurLogKnownFieldKey.TIMESTAMP] ?? ''));
        if (timestamp === null || !Number.isFinite(timestamp)) {
          return [];
        }
        const logId = String(row[OurLogKnownFieldKey.ID] ?? '');
        const severity = String(row[OurLogKnownFieldKey.SEVERITY] ?? t('log'));
        return [
          {
            key: `log-${logId || timestamp}`,
            lane: 'logs' as const,
            timestamp,
            title: severity,
            subtitle: String(row[OurLogKnownFieldKey.MESSAGE] ?? ''),
            color: colorForLevel(severity, severityColors),
            level: severity,
            source: 'log' as const,
            target: logId ? {section: SectionKey.LOGS, id: logId} : undefined,
          },
        ];
      }),
    [logs, severityColors]
  );

  const metricItems = useMemo<TimelineItem[]>(
    () =>
      metrics.flatMap(metric => {
        const timestamp = parseTimestamp(
          String(metric[TraceMetricKnownFieldKey.TIMESTAMP] ?? '')
        );
        if (timestamp === null) {
          return [];
        }
        const metricId = String(metric[TraceMetricKnownFieldKey.ID] ?? '');
        const metricName = String(
          metric[TraceMetricKnownFieldKey.METRIC_NAME] ?? t('(unknown metric)')
        );
        const value = metric[TraceMetricKnownFieldKey.METRIC_VALUE];
        const unit = metric[TraceMetricKnownFieldKey.METRIC_UNIT];
        return [
          {
            key: `metric-${metricId || timestamp}-${metricName}`,
            lane: 'metrics' as const,
            timestamp,
            title: metricName,
            subtitle: [value, unit]
              .filter(part => part !== undefined && part !== '')
              .join(' '),
            color: severityColors.default,
            source: 'metric' as const,
            target: metricId ? {section: SectionKey.METRICS, id: metricId} : undefined,
          },
        ];
      }),
    [metrics, severityColors.default]
  );

  const items = useMemo(
    () =>
      [
        ...breadcrumbItems,
        ...traceItems,
        ...logItems,
        ...metricItems,
        ...eventItems,
      ].sort((a, b) => a.timestamp - b.timestamp),
    [breadcrumbItems, eventItems, logItems, metricItems, traceItems]
  );

  // Everything the timeline actually draws. The focal event is tracked separately (it
  // gets the "This Issue" line, not a marker), so it must not leak into the lanes or
  // into the count we show. Derive both from here so they can never drift apart.
  const drawnItems = useMemo(() => items.filter(item => !item.isCurrentEvent), [items]);

  // This section is deliberately not a FoldSection (it should always be visible), so it
  // has to register itself with the issue-details context by hand. Without this the
  // "Jump To" nav never lists it, even though it has a label for the key.
  const hasDrawnItems = drawnItems.length > 0;
  useEffect(() => {
    if (!hasDrawnItems) {
      return;
    }
    dispatch({
      type: 'UPDATE_EVENT_SECTION',
      key: SectionKey.EVENT_CONTEXT_TIMELINE,
      config: {initialCollapse: false},
    });
    return () =>
      dispatch({
        type: 'REMOVE_EVENT_SECTION',
        key: SectionKey.EVENT_CONTEXT_TIMELINE,
      });
  }, [dispatch, hasDrawnItems]);

  const [domainStart, domainEnd] = useMemo(() => {
    const timestamps = items.map(item => item.timestamp);
    if (eventTimestamp !== null) {
      timestamps.push(eventTimestamp);
    }
    return timestamps.length === 0
      ? [0, 0]
      : [Math.min(...timestamps), Math.max(...timestamps)];
  }, [eventTimestamp, items]);
  const domainDuration = domainEnd - domainStart;

  const segments = useMemo(
    () =>
      buildScale(
        items.map(item => item.timestamp),
        domainStart,
        domainEnd
      ),
    [domainEnd, domainStart, items]
  );

  const scaleFraction = useCallback(
    (timestamp: number) => {
      if (segments.length === 0) {
        return 0.5;
      }
      if (timestamp <= domainStart) {
        return 0;
      }
      if (timestamp >= domainEnd) {
        return 1;
      }
      const segment =
        segments.find(
          candidate => timestamp >= candidate.startTime && timestamp <= candidate.endTime
        ) ?? segments.at(-1)!;
      const span = segment.endTime - segment.startTime;
      const ratio = span <= 0 ? 0 : (timestamp - segment.startTime) / span;
      return (
        segment.startFraction + ratio * (segment.endFraction - segment.startFraction)
      );
    },
    [domainEnd, domainStart, segments]
  );

  const toFraction = useCallback(
    (timestamp: number) => toDisplay(scaleFraction(timestamp)),
    [scaleFraction]
  );

  const eventFraction = eventTimestamp === null ? 1 : toFraction(eventTimestamp);

  // Scrolls to a section and highlights the given rows (logs/metrics). Only the section
  // hash goes in the URL — it's a durable, shareable address. The highlight itself is
  // transient, so it lives in the focus store instead of being written and un-written
  // as navigation.
  const focusSection = useCallback(
    (section: SectionKey, ids: string[]) => {
      navigate({...location, hash: `#${section}`}, {replace: true});
      focusEventContextRows(section, ids);

      // Scroll on every click, even when the hash is unchanged. Router navigation
      // is a no-op when the location doesn't change, so repeat clicks in the same
      // lane would otherwise do nothing once the section is already addressed.
      requestAnimationFrame(() => {
        document
          .getElementById(section)
          ?.scrollIntoView({behavior: 'smooth', block: 'start'});
      });
    },
    [location, navigate]
  );

  const activateItem = useCallback(
    (item: TimelineItem) => {
      // Errors link out to their own issue/event rather than staying on the page.
      if (item.to) {
        navigate(item.to);
        return;
      }
      if (!item.target) {
        return;
      }
      const {section, id} = item.target;
      focusSection(section, id ? [id] : []);
    },
    [focusSection, navigate]
  );

  // Activating a cluster highlights every clustered item that shares the most severe
  // item's section, so all of e.g. three simultaneous metrics pulse at once instead
  // of only one.
  const activateCluster = useCallback(
    (clusterItems: TimelineItem[]) => {
      const representative = clusterRepresentative(clusterItems);
      if (representative.to) {
        navigate(representative.to);
        return;
      }
      if (!representative.target) {
        return;
      }
      const {section} = representative.target;
      const ids = clusterItems.flatMap(item =>
        item.target?.section === section && item.target.id ? [item.target.id] : []
      );
      focusSection(section, ids);
    },
    [focusSection, navigate]
  );

  // One pass over the drawn items produces every lane's clusters. Doing this inline in
  // the JSX re-ran a filter, a map and a sort per lane on every render — including the
  // renders caused by unrelated location changes on the issue page.
  const clustersByLane = useMemo(() => {
    const itemsByLane = new Map<LaneId, TimelineItem[]>();
    drawnItems.forEach(item => {
      const laneItems = itemsByLane.get(item.lane);
      if (laneItems) {
        laneItems.push(item);
      } else {
        itemsByLane.set(item.lane, [item]);
      }
    });
    return new Map(
      Array.from(itemsByLane, ([lane, laneItems]) => [
        lane,
        clusterLaneItems(laneItems, toFraction),
      ])
    );
  }, [drawnItems, toFraction]);

  // The error on its own isn't a timeline worth showing.
  if (drawnItems.length === 0) {
    return null;
  }

  const lanes: Array<{id: LaneId; label: string; hint?: string}> = [
    {id: 'issues', label: t('Other Issues')},
    {id: 'network', label: t('Network')},
    {id: 'interaction', label: t('User Activity')},
    {id: 'breadcrumbs', label: t('Breadcrumbs')},
    {
      id: 'logs',
      label: t('Logs'),
      // Only worth explaining when we actually dropped something.
      hint:
        logs.length > MAX_TIMELINE_LOGS
          ? t(
              'Showing the %s most recent logs. Open the Logs section below for the full list.',
              MAX_TIMELINE_LOGS
            )
          : undefined,
    },
    {id: 'metrics', label: t('Metrics')},
  ];

  // Only render lanes that actually have markers, so an empty lane doesn't take up a row.
  const visibleLanes = lanes.filter(lane => clustersByLane.has(lane.id));

  return (
    <Fragment>
      <TimelineSection
        id={SectionKey.EVENT_CONTEXT_TIMELINE}
        role="region"
        aria-label={t('Event Context Timeline')}
        scrollMargin={navScrollMargin ?? 0}
      >
        <Flex align="center" gap="xs">
          <Text size="lg">{t('Event Context Timeline')}</Text>
          <FeatureBadge type="beta" />
        </Flex>
        <Stack gap="xl" padding="xl" background="secondary" radius="md">
          <Flex align="start" justify="between" gap="md">
            <Stack gap="md">
              <Flex gap="md" wrap="wrap">
                <StatTile
                  label={t('Started')}
                  value={<DateTime date={domainStart} timeOnly seconds />}
                />
                <StatTile
                  label={t('Duration')}
                  value={getDuration(domainDuration / 1000, 2, true)}
                />
                <StatTile
                  label={t('Events Shown')}
                  value={drawnItems.length}
                  hint={t(
                    'Everything the timeline can show from this event and its trace. The sections below have the complete data.'
                  )}
                />
              </Flex>
              <Text size="sm" variant="muted">
                {isLoading
                  ? t('Loading event context…')
                  : t(
                      'An overview of what happened around this event. Select a marker to jump to its full details below.'
                    )}
              </Text>
            </Stack>
            <FullContextButton event={event} sessionId={sessionId} />
          </Flex>

          <TimelineGrid>
            {visibleLanes.map(lane => (
              <TimelineLane
                key={lane.id}
                label={lane.label}
                hint={lane.hint}
                clusters={clustersByLane.get(lane.id)!}
                onActivateItem={activateItem}
                onActivateCluster={activateCluster}
              />
            ))}

            <Overlay>
              {segments
                .filter(segment => segment.isIdle)
                .map(segment => (
                  <IdleBand
                    key={`${segment.startTime}-${segment.endTime}`}
                    left={toDisplay(segment.startFraction) * 100}
                    width={
                      (toDisplay(segment.endFraction) -
                        toDisplay(segment.startFraction)) *
                      100
                    }
                  >
                    <IdlePill>
                      <Text size="xs" variant="muted">
                        {t(
                          '%s idle',
                          getDuration(
                            (segment.endTime - segment.startTime) / 1000,
                            1,
                            true
                          )
                        )}
                      </Text>
                    </IdlePill>
                  </IdleBand>
                ))}

              {eventTimestamp !== null && (
                <EventLine left={eventFraction * 100} lineColor={eventColor}>
                  <EventLineLabel lineColor={eventColor}>
                    {t('This Issue')}
                  </EventLineLabel>
                </EventLine>
              )}
            </Overlay>
          </TimelineGrid>

          <AxisRow>
            {getAxisTicks(segments, domainStart).map(tick => (
              <AxisTick key={tick.left} left={tick.left}>
                <TickMark />
                <Text size="xs" variant="muted" tabular>
                  {tick.elapsedSeconds <= 0
                    ? '0s'
                    : getDuration(tick.elapsedSeconds, 1, true)}
                </Text>
              </AxisTick>
            ))}
          </AxisRow>
        </Stack>
      </TimelineSection>
      <SectionDivider orientation="horizontal" margin="lg 0" />
    </Fragment>
  );
}

const LANE_LABEL_WIDTH = '128px';

// One stacking order for everything inside TimelineGrid: lane backgrounds (implicit 0),
// then the idle/event overlay, then the markers, then whichever marker is hovered.
const OVERLAY_Z_INDEX = 1;
const MARKER_Z_INDEX = 2;
const ACTIVE_MARKER_Z_INDEX = 3;

const TimelineGrid = styled('div')`
  position: relative;
  display: grid;
  /* Bottom strip is where the idle pills land, so they never sit on the last lane. */
  padding-bottom: ${p => p.theme.space['2xl']};
  grid-template-columns: ${LANE_LABEL_WIDTH} 1fr;
  row-gap: ${p => p.theme.space.md};
  align-items: center;
`;

const LaneLabel = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.sm};
  align-items: center;
  padding-right: ${p => p.theme.space.md};
`;

const LaneTrack = styled('div')`
  position: relative;
  height: 24px;
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.sm};
`;

const Marker = styled('button')<{
  actionable: boolean;
  left: number;
  markerColor: string;
}>`
  --marker-lift: 0px;
  position: absolute;
  z-index: ${MARKER_Z_INDEX};
  top: 50%;
  left: ${p => p.left}%;
  width: 10px;
  height: 12px;
  padding: 0;
  background: ${p => p.markerColor};
  border: 0;
  cursor: ${p => (p.actionable ? 'pointer' : 'default')};
  border-radius: ${p => p.theme.radius['2xs']};
  transform: translate(-50%, calc(-50% - var(--marker-lift)));
  transition:
    transform ${p => p.theme.motion.snap.fast},
    box-shadow ${p => p.theme.motion.snap.fast};

  /* Lift slightly with a subtle shadow on hover, then press back down when clicked. */
  &:hover,
  &:focus-visible {
    --marker-lift: 1px;
    z-index: ${ACTIVE_MARKER_Z_INDEX};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  &:active {
    --marker-lift: 0px;
    box-shadow: none;
  }
`;

// A merged marker for simultaneous events: wider than a single dot and labeled with
// how many items it stands in for, colored by the most severe one it hides.
const ClusterMarker = styled('button')<{
  actionable: boolean;
  left: number;
  markerColor: string;
}>`
  --marker-lift: 0px;
  position: absolute;
  z-index: ${MARKER_Z_INDEX};
  top: 50%;
  left: ${p => p.left}%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 ${p => p.theme.space['2xs']};
  background: ${p => p.markerColor};
  color: ${p => p.theme.colors.white};
  border: 0;
  cursor: ${p => (p.actionable ? 'pointer' : 'default')};
  border-radius: ${p => p.theme.radius['2xs']};
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1;
  transform: translate(-50%, calc(-50% - var(--marker-lift)));
  transition:
    transform ${p => p.theme.motion.snap.fast},
    box-shadow ${p => p.theme.motion.snap.fast};

  &:hover,
  &:focus-visible {
    --marker-lift: 1px;
    z-index: ${ACTIVE_MARKER_Z_INDEX};
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  &:active {
    --marker-lift: 0px;
    box-shadow: none;
  }
`;

// Sits between the lane backgrounds and the markers: the idle hatching has to tint the
// lanes it spans, but it must never obscure the events drawn on them.
const Overlay = styled('div')`
  position: absolute;
  z-index: ${OVERLAY_Z_INDEX};
  inset: 0 0 0 ${LANE_LABEL_WIDTH};
  pointer-events: none;
`;

const IdleBand = styled('div')<{left: number; width: number}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${p => p.left}%;
  display: grid;
  width: ${p => p.width}%;
  align-content: end;
  justify-items: center;
  background: repeating-linear-gradient(
    45deg,
    ${p => p.theme.tokens.background.secondary},
    ${p => p.theme.tokens.background.secondary} 4px,
    transparent 4px,
    transparent 8px
  );
  border-right: 1px dashed ${p => p.theme.tokens.border.secondary};
  border-left: 1px dashed ${p => p.theme.tokens.border.secondary};
`;

const IdlePill = styled('div')`
  padding: 0 ${p => p.theme.space.xs};
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.full};
  white-space: nowrap;
`;

// Severity-colored like the markers are. A neutral line reads as chrome and disappears
// against the track, and this line is the one thing in the widget the eye needs to find
// first, so it takes the focal event's own color.
const EventLine = styled('div')<{left: number; lineColor: string}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${p => p.left}%;
  border-left: 2px dashed ${p => p.lineColor};
`;

const EventLineLabel = styled('span')<{lineColor: string}>`
  position: absolute;
  top: -18px;
  right: 0;
  padding: 0 ${p => p.theme.space.xs};
  color: ${p => p.lineColor};
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  white-space: nowrap;
`;

const AxisRow = styled('div')`
  position: relative;
  height: 24px;
  margin-left: ${LANE_LABEL_WIDTH};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;

// Always centred on its position. The ticks share the markers' padded coordinate space
// (see `toDisplay`), so the EDGE_PAD band leaves room for the end labels — the previous
// start/end alignment shifted the tick *mark* off its own position to make that room.
const AxisTick = styled('div')<{left: number}>`
  position: absolute;
  top: 0;
  left: ${p => p.left}%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${p => p.theme.space['2xs']};
  transform: translateX(-50%);
`;

const TickMark = styled('span')`
  height: 4px;
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

const TimelineSection = styled('section')<{scrollMargin: number}>`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
  scroll-margin-top: calc(${p => p.theme.space.md} + ${p => p.scrollMargin}px);
`;
