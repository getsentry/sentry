import type {KeyboardEvent, PointerEvent} from 'react';
import {Fragment, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import type {LocationDescriptor} from 'history';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {getEnhancedBreadcrumbs} from 'sentry/components/events/breadcrumbs/utils';
import {getTraceDateTimeRange} from 'sentry/components/events/interfaces/spans/utils';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {t, tct, tn} from 'sentry/locale';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {getTitle} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
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
import {getLogRowTimestampMillis, getLogsUrl} from 'sentry/views/explore/logs/utils';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {getTraceTargetFromEvent} from 'sentry/views/performance/traceDetails/traceTarget';

type LaneId = 'traces' | 'errors' | 'ui' | 'logs';

interface TimelineItem {
  color: string;
  key: string;
  lane: LaneId;
  source: 'breadcrumb' | 'trace' | 'log' | 'event';
  timestamp: number;
  title: string;
  isCurrentEvent?: boolean;
  subtitle?: string;
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
 */
function useTraceEvents(event: Event) {
  const organization = useOrganization();
  const traceId = event.contexts?.trace?.trace_id;
  const eventSeconds =
    moment(event.dateReceived || event.dateCreated).valueOf() / 1000 || 0;
  const {start, end} = getTraceDateTimeRange({
    start: eventSeconds,
    end: eventSeconds,
  });

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

/** Fraction of the timeline covered by the window before the user drags it. */
const DEFAULT_WINDOW_SIZE = 0.18;
const MIN_WINDOW_SIZE = 0.02;
const KEYBOARD_STEP = 0.02;
/** Content stays this far from either track edge, so nothing renders flush against it. */
const EDGE_PAD = 0.04;
/** Quiet stretches at least this long collapse into a fixed-width column. */
const IDLE_GAP_THRESHOLD_MS = 4000;
/** Share of the axis each collapsed gap takes, so idle time can't crowd out real events. */
const IDLE_GAP_FRACTION = 0.07;
const MAX_TOTAL_IDLE_FRACTION = 0.4;
const MAX_LISTED_ITEMS = 50;
/** Where time marks sit along the axis, as fractions of the (compressed) timeline. */
const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1];

function parseTimestamp(timestamp?: string | null): number | null {
  if (!timestamp) {
    return null;
  }
  const milliseconds = Date.parse(timestamp);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function laneForBreadcrumb(type?: BreadcrumbType): LaneId {
  switch (type) {
    case BreadcrumbType.HTTP:
    case BreadcrumbType.QUERY:
    case BreadcrumbType.TRANSACTION:
      return 'traces';
    case BreadcrumbType.ERROR:
    case BreadcrumbType.WARNING:
      return 'errors';
    case BreadcrumbType.UI:
    case BreadcrumbType.USER:
    case BreadcrumbType.NAVIGATION:
      return 'ui';
    default:
      return 'logs';
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

function clampWindow(
  mode: 'pan' | 'start' | 'end',
  [start, end]: [number, number],
  delta: number
): [number, number] {
  if (mode === 'pan') {
    const size = end - start;
    const nextStart = Math.min(Math.max(start + delta, 0), 1 - size);
    return [nextStart, nextStart + size];
  }
  if (mode === 'start') {
    return [Math.min(Math.max(start + delta, 0), end - MIN_WINDOW_SIZE), end];
  }
  return [start, Math.max(Math.min(end + delta, 1), start + MIN_WINDOW_SIZE)];
}

/**
 * A compressed, multi-lane view of everything we know happened around this error.
 *
 * Logs are only available through the Logs query param providers, so they're set up
 * here (mirroring `OurlogsSection`) and the timeline itself stays a plain component.
 */
export function EventContextTimeline({event}: {event: Event}) {
  const organization = useOrganization();
  const traceId = event.contexts?.trace?.trace_id;

  if (!traceId || !isLogsEnabled(organization)) {
    return <EventContextTimelineContent event={event} logs={[]} />;
  }

  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.ISSUE_DETAILS}
      source="state"
      freeze={{traceId}}
    >
      <LogsPageDataProvider disabled={false} staleTime={EXPLORE_FIVE_MIN_STALE_TIME}>
        <EventContextTimelineWithLogs event={event} />
      </LogsPageDataProvider>
    </LogsQueryParamsProvider>
  );
}

function EventContextTimelineWithLogs({event}: {event: Event}) {
  const {data} = useLogsPageDataQueryResult();
  return <EventContextTimelineContent event={event} logs={data ?? []} />;
}

function EventContextTimelineContent({
  event,
  logs,
}: {
  event: Event;
  logs: OurLogsResponseItem[];
}) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const {data: traceResponse, isPending: isLoading} = useTraceEvents(event);
  const traceEvents = traceResponse?.data;

  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: 'pan' | 'start' | 'end';
    originX: number;
    window: [number, number];
  } | null>(null);
  const [selection, setSelection] = useState<[number, number] | null>(null);

  const laneColors = useMemo(
    () => ({
      traces: theme.tokens.content.accent,
      errors: theme.tokens.content.danger,
      ui: theme.tokens.content.warning,
      logs: theme.tokens.content.promotion,
    }),
    [theme]
  );

  const eventTimestamp = parseTimestamp(event.dateCreated ?? event.dateReceived);

  const breadcrumbItems = useMemo<TimelineItem[]>(
    () =>
      getEnhancedBreadcrumbs(event, theme).flatMap((crumb, index) => {
        // Crumbs without `raw` are synthesized from the event itself, which already
        // has its own marker, and crumbs without a timestamp can't be placed.
        const timestamp = crumb.raw ? parseTimestamp(crumb.raw.timestamp) : null;
        return timestamp === null
          ? []
          : [
              {
                key: `breadcrumb-${index}`,
                lane: laneForBreadcrumb(crumb.breadcrumb.type),
                timestamp,
                title: crumb.title,
                subtitle:
                  crumb.breadcrumb.message ??
                  getBreadcrumbSubtitle(crumb.breadcrumb.data),
                color: crumb.colorConfig.icon,
                source: 'breadcrumb' as const,
              },
            ];
      }),
    [event, theme]
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
        lane: 'errors' as const,
        timestamp: eventTimestamp,
        title: title || event.title || event.message,
        subtitle: subtitle || event.culprit || undefined,
        color: laneColors.errors,
        source: 'event' as const,
        isCurrentEvent: true,
      },
    ];
  }, [event, eventTimestamp, laneColors.errors]);

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
            lane: isError ? ('errors' as const) : ('traces' as const),
            timestamp,
            title: traceEvent.title,
            subtitle: traceEvent.transaction || traceEvent.culprit || undefined,
            color: isError ? laneColors.errors : laneColors.traces,
            source: 'trace' as const,
            to: {
              pathname: `/organizations/${organization.slug}/issues/${traceEvent['issue.id']}/events/${traceEvent.id}/`,
              query: {referrer: 'event-context-timeline'},
            },
          },
        ];
      }),
    [event.id, laneColors, organization.slug, traceEvents]
  );

  const logItems = useMemo<TimelineItem[]>(
    () =>
      logs.flatMap(row => {
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
            color: laneColors.logs,
            source: 'log' as const,
            to: logId
              ? getLogsUrl({
                  organization,
                  selection: {
                    projects: [ALL_ACCESS_PROJECTS],
                    environments: [],
                    datetime: {
                      start: getUtcDateString(moment(timestamp).subtract(1, 'day')),
                      end: getUtcDateString(moment(timestamp).add(1, 'day')),
                      period: null,
                      utc: null,
                    },
                  },
                  query: `${OurLogKnownFieldKey.ID}:${logId}`,
                })
              : undefined,
          },
        ];
      }),
    [laneColors, logs, organization]
  );

  const items = useMemo(
    () =>
      [...breadcrumbItems, ...traceItems, ...logItems, ...eventItems].sort(
        (a, b) => a.timestamp - b.timestamp
      ),
    [breadcrumbItems, eventItems, logItems, traceItems]
  );

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

  const scaleFraction = (timestamp: number) => {
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
    return segment.startFraction + ratio * (segment.endFraction - segment.startFraction);
  };

  const scaleTime = (fraction: number) => {
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
  };

  // Content is inset from the track edges so nothing sits flush against them, while the
  // window still spans the full track and can be dragged all the way to either edge.
  const toDisplay = (fraction: number) => EDGE_PAD + fraction * (1 - 2 * EDGE_PAD);
  const toFraction = (timestamp: number) => toDisplay(scaleFraction(timestamp));
  const fromFraction = (fraction: number) =>
    scaleTime(Math.min(Math.max((fraction - EDGE_PAD) / (1 - 2 * EDGE_PAD), 0), 1));

  // Until the user drags, the window follows the error so it always frames "here".
  const eventFraction = eventTimestamp === null ? 1 : toFraction(eventTimestamp);
  const defaultStart = Math.min(
    Math.max(eventFraction - DEFAULT_WINDOW_SIZE / 2, 0),
    1 - DEFAULT_WINDOW_SIZE
  );
  const [windowStart, windowEnd] = selection ?? [
    defaultStart,
    defaultStart + DEFAULT_WINDOW_SIZE,
  ];

  const dragHandlers = (mode: 'pan' | 'start' | 'end') => ({
    onPointerDown: (pointerEvent: PointerEvent<HTMLElement>) => {
      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
      dragRef.current = {
        mode,
        originX: pointerEvent.clientX,
        window: [windowStart, windowEnd],
      };
    },
    onPointerMove: (pointerEvent: PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      const width = trackRef.current?.getBoundingClientRect().width ?? 0;
      if (!drag || width === 0) {
        return;
      }
      pointerEvent.stopPropagation();
      setSelection(
        clampWindow(drag.mode, drag.window, (pointerEvent.clientX - drag.originX) / width)
      );
    },
    onPointerUp: (pointerEvent: PointerEvent<HTMLElement>) => {
      dragRef.current = null;
      if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) {
        pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId);
      }
    },
  });

  // The error on its own isn't a timeline worth showing.
  if (items.every(item => item.isCurrentEvent)) {
    return null;
  }

  const windowStartTime = fromFraction(windowStart);
  const windowEndTime = fromFraction(windowEnd);
  const selectedItems = items.filter(
    item => item.timestamp >= windowStartTime && item.timestamp <= windowEndTime
  );

  const lanes: Array<{id: LaneId; label: string}> = [
    {id: 'traces', label: t('Traces')},
    {id: 'errors', label: t('Errors')},
    {id: 'ui', label: t('User Interaction')},
    {id: 'logs', label: t('Logs')},
  ];

  return (
    <FoldSection
      sectionKey={SectionKey.EVENT_CONTEXT_TIMELINE}
      title={t('Event Context Timeline')}
    >
      <Stack gap="xl" padding="xl" background="secondary" radius="md">
        <Flex align="center" justify="between" gap="md" wrap="wrap">
          <Stack gap="2xs">
            <Text size="sm" variant="muted">
              {isLoading
                ? t('Loading trace events and logs…')
                : t('Drag the window to scope the events around this error.')}
            </Text>
            <Text size="xs" variant="muted">
              {tct('[time] · [duration] total · [count] events', {
                time: <DateTime date={domainStart} timeOnly seconds />,
                duration: getDuration(domainDuration / 1000, 2, true),
                count: items.length,
              })}
            </Text>
          </Stack>
          {event.contexts?.trace?.trace_id && (
            <LinkButton
              size="xs"
              to={getTraceTargetFromEvent(event, organization, location)}
            >
              {t('View full trace')}
            </LinkButton>
          )}
        </Flex>

        <TimelineGrid>
          {lanes.map(lane => (
            <Fragment key={lane.id}>
              <LaneLabel>
                <LaneDot laneColor={laneColors[lane.id]} />
                <Text size="sm" variant="muted" ellipsis>
                  {lane.label}
                </Text>
              </LaneLabel>
              <LaneTrack>
                {items
                  .filter(item => item.lane === lane.id && !item.isCurrentEvent)
                  .map(item => (
                    <Tooltip
                      key={item.key}
                      title={`${item.title}${item.subtitle ? ` — ${item.subtitle}` : ''}`}
                      skipWrapper
                    >
                      <Marker
                        markerColor={item.color}
                        left={toFraction(item.timestamp) * 100}
                      />
                    </Tooltip>
                  ))}
                {lane.id === 'errors' && eventTimestamp !== null && (
                  <EventMarker left={eventFraction * 100} />
                )}
              </LaneTrack>
            </Fragment>
          ))}

          <Overlay ref={trackRef}>
            {segments
              .filter(segment => segment.isIdle)
              .map(segment => (
                <IdleBand
                  key={`${segment.startTime}-${segment.endTime}`}
                  left={toDisplay(segment.startFraction) * 100}
                  width={
                    (toDisplay(segment.endFraction) - toDisplay(segment.startFraction)) *
                    100
                  }
                >
                  <IdlePill>
                    <Text size="xs" variant="muted">
                      {t(
                        '%s idle',
                        getDuration((segment.endTime - segment.startTime) / 1000, 1, true)
                      )}
                    </Text>
                  </IdlePill>
                </IdleBand>
              ))}

            {eventTimestamp !== null && (
              <EventLine left={eventFraction * 100}>
                <EventLineLabel>{t('This Event')}</EventLineLabel>
              </EventLine>
            )}

            <SelectionWindow
              left={windowStart * 100}
              width={(windowEnd - windowStart) * 100}
              role="group"
              tabIndex={0}
              aria-label={t('Selected time range')}
              onKeyDown={(keyEvent: KeyboardEvent<HTMLElement>) => {
                const direction = keyEvent.key === 'ArrowLeft' ? -1 : 1;
                if (keyEvent.key !== 'ArrowLeft' && keyEvent.key !== 'ArrowRight') {
                  return;
                }
                keyEvent.preventDefault();
                setSelection(
                  clampWindow(
                    keyEvent.shiftKey ? 'end' : 'pan',
                    [windowStart, windowEnd],
                    direction * KEYBOARD_STEP
                  )
                );
              }}
              {...dragHandlers('pan')}
            >
              <ResizeHandle position="left" {...dragHandlers('start')} />
              <ResizeHandle position="right" {...dragHandlers('end')} />
            </SelectionWindow>
          </Overlay>
        </TimelineGrid>

        <AxisRow>
          {AXIS_TICKS.map(fraction => {
            const elapsed = (fromFraction(fraction) - domainStart) / 1000;
            return (
              <AxisTick
                key={fraction}
                left={fraction * 100}
                align={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}
              >
                <TickMark />
                <Text size="xs" variant="muted" tabular>
                  {elapsed <= 0 ? '+0s' : `+${getDuration(elapsed, 1, true)}`}
                </Text>
              </AxisTick>
            );
          })}
        </AxisRow>

        <Stack gap="xs">
          <Text size="sm" variant="muted">
            {tn(
              '%s event in the selected range',
              '%s events in the selected range',
              selectedItems.length
            )}
          </Text>
          {selectedItems.length === 0 ? (
            <Text size="sm" variant="muted">
              {t('Drag or resize the window to include nearby events.')}
            </Text>
          ) : (
            <Stack gap="0">
              {selectedItems.slice(0, MAX_LISTED_ITEMS).map(item => (
                <ItemRow key={item.key}>
                  <Text size="sm" variant="muted" tabular>
                    {`+${getDuration((item.timestamp - domainStart) / 1000, 2, true)}`}
                  </Text>
                  <LaneDot laneColor={item.color} />
                  <Stack gap="2xs" minWidth="0">
                    <Text size="md" bold={item.isCurrentEvent} ellipsis>
                      {item.title}
                    </Text>
                    <Flex gap="sm" align="center" minWidth="0">
                      <ItemType laneColor={item.color}>
                        {lanes.find(lane => lane.id === item.lane)?.label}
                      </ItemType>
                      {item.isCurrentEvent && (
                        <Tag variant="danger">{t('This event')}</Tag>
                      )}
                      <Text size="sm" variant="muted" ellipsis>
                        {item.subtitle}
                      </Text>
                    </Flex>
                  </Stack>
                  {item.to && (
                    <LinkButton size="xs" to={item.to}>
                      {item.source === 'log' ? t('View log') : t('View trace')}
                    </LinkButton>
                  )}
                </ItemRow>
              ))}
              {selectedItems.length > MAX_LISTED_ITEMS && (
                <Text size="sm" variant="muted">
                  {tn(
                    '%s more event in this range',
                    '%s more events in this range',
                    selectedItems.length - MAX_LISTED_ITEMS
                  )}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </Stack>
    </FoldSection>
  );
}

const LANE_LABEL_WIDTH = '128px';

const TimelineGrid = styled('div')`
  position: relative;
  display: grid;
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

const LaneDot = styled('span')<{laneColor: string}>`
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  background: ${p => p.laneColor};
  border-radius: ${p => p.theme.radius['2xs']};
`;

const LaneTrack = styled('div')`
  position: relative;
  height: 24px;
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.sm};
`;

const Marker = styled('span')<{left: number; markerColor: string}>`
  position: absolute;
  top: 50%;
  left: ${p => p.left}%;
  width: 10px;
  height: 12px;
  background: ${p => p.markerColor};
  border-radius: ${p => p.theme.radius['2xs']};
  transform: translate(-50%, -50%);
`;

const EventMarker = styled('span')<{left: number}>`
  position: absolute;
  top: 50%;
  left: ${p => p.left}%;
  width: 14px;
  height: 16px;
  background: ${p => p.theme.tokens.background.danger.vibrant};
  border: 2px solid ${p => p.theme.tokens.border.danger.vibrant};
  border-radius: ${p => p.theme.radius['2xs']};
  transform: translate(-50%, -50%);
`;

const Overlay = styled('div')`
  position: absolute;
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

const EventLine = styled('div')<{left: number}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${p => p.left}%;
  border-left: 2px dashed ${p => p.theme.tokens.border.danger.vibrant};
`;

const EventLineLabel = styled('span')`
  position: absolute;
  top: -18px;
  right: 0;
  padding: 0 ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.danger};
  font-size: ${p => p.theme.font.size.xs};
  white-space: nowrap;
`;

const SelectionWindow = styled('div')<{left: number; width: number}>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: ${p => p.left}%;
  width: ${p => p.width}%;
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
  border: 1px solid ${p => p.theme.tokens.border.accent.vibrant};
  border-radius: ${p => p.theme.radius.sm};
  cursor: grab;
  pointer-events: auto;
  touch-action: none;

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
    outline-offset: 2px;
  }
`;

const ResizeHandle = styled('div')<{position: 'left' | 'right'}>`
  position: absolute;
  top: 50%;
  ${p => p.position}: -5px;
  width: 10px;
  height: 28px;
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.accent.vibrant};
  border-radius: ${p => p.theme.radius.sm};
  cursor: ew-resize;
  transform: translateY(-50%);
  touch-action: none;
`;

const AxisRow = styled('div')`
  position: relative;
  height: 24px;
  margin-left: ${LANE_LABEL_WIDTH};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const AxisTick = styled('div')<{
  align: 'start' | 'middle' | 'end';
  left: number;
}>`
  position: absolute;
  top: 0;
  left: ${p => p.left}%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${p => p.theme.space['2xs']};
  transform: translateX(
    ${p => (p.align === 'start' ? '0' : p.align === 'end' ? '-100%' : '-50%')}
  );
`;

const TickMark = styled('span')`
  height: 4px;
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

const ItemRow = styled('div')`
  display: grid;
  grid-template-columns: 72px 10px 1fr auto;
  gap: ${p => p.theme.space.md};
  align-items: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.sm};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

  &:hover {
    background: ${p => p.theme.tokens.background.primary};
  }
`;

const ItemType = styled('span')<{laneColor: string}>`
  color: ${p => p.laneColor};
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
