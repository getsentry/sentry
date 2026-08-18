import {Fragment, useMemo, useState} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getLogSeverityLevel, SeverityLevel} from 'sentry/views/explore/logs/utils';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import {getTraceLink, ROW_CONFIG} from './rowConfig';
import {formatDurationMs, formatOffset} from './sessionTime';
import {TelemetryTypeIcon} from './telemetryTypeIcon';
import type {
  SessionEvent,
  SessionRange,
  SessionTimelineItem,
  SessionTraceGroup,
} from './useSessionDetail';

const DATASET_BY_KEY = Object.fromEntries(
  SESSION_DATASETS.map(config => [config.key, config])
) as Record<SessionDatasetKey, (typeof SESSION_DATASETS)[number]>;

/**
 * How a row is colored: `muted` unless it is carrying something worth
 * interrupting for.
 */
type SeverityVariant = 'danger' | 'warning' | 'muted';

/**
 * Log levels worth a color, and which one. Everything quieter stays muted, so red
 * in the rail keeps meaning "something went wrong" rather than "this row is a
 * log" — and a fatal log stops looking like a trace-level one, which is what
 * happens when a whole dataset takes a single hue.
 *
 * The variants match the logs explorer's own severity colors, so a level reads
 * the same here as it does there.
 */
const LOUD_LOG_LEVELS: Partial<Record<SeverityLevel, SeverityVariant>> = {
  [SeverityLevel.FATAL]: 'danger',
  [SeverityLevel.ERROR]: 'danger',
  [SeverityLevel.WARN]: 'warning',
};

interface Props {
  /** Session extent, which every offset is measured from. */
  bounds: SessionRange | undefined;
  dateParams: Record<string, any>;
  isError: boolean;
  /** True when a filter is hiding rows, which changes what an empty rail means. */
  isFiltered: boolean;
  isPending: boolean;
  /** True when a scrubber selection is narrowing the rail. */
  isWindowed: boolean;
  items: SessionTimelineItem[];
}

/** Where an item sits on the rail, and how long it lasted. */
function positionOf(item: SessionTimelineItem): {
  duration: number | undefined;
  timestamp: number | undefined;
} {
  return item.kind === 'event'
    ? {timestamp: item.event.timestamp, duration: item.event.duration}
    : {timestamp: item.group.timestamp, duration: item.group.duration};
}

/**
 * Identifies a group by its members rather than by position, so expansion
 * survives a re-sort (which reverses a run but keeps its membership) and stays
 * unique when one trace shows up in more than one run.
 */
function groupKey(group: SessionTraceGroup): string {
  return [group.trace, ...group.spans.map(span => String(span.row.id)).sort()].join('-');
}

/**
 * How bad a row is, which is the only thing the rail spends color on. The type is
 * said by the row's icon instead, which leaves severity a hue of its own: on a
 * screen of muted rows, the red ones are the answer to "what happened here".
 *
 * Errors are always danger — an error event is a problem whatever its `level`
 * says. Spans and metrics have no severity to report, and logs carry theirs in a
 * field.
 */
function severityVariant(event: SessionEvent): SeverityVariant {
  if (event.key === 'errors') {
    return 'danger';
  }
  if (event.key !== 'logs') {
    return 'muted';
  }
  const severity = typeof event.row.severity === 'string' ? event.row.severity : null;
  return LOUD_LOG_LEVELS[getLogSeverityLevel(null, severity)] ?? 'muted';
}

/** The shape color for a variant: `graphics` for drawn things, not for text. */
function graphicsColor(variant: SeverityVariant, theme: Theme): string {
  return theme.tokens.graphics[variant === 'muted' ? 'neutral' : variant].vibrant;
}

/**
 * The session read top to bottom: one row per telemetry item, offsets relative to
 * the session start, and the item's own icon on a continuous spine.
 *
 * Two things separate this from the flat table it replaces. Type and severity are
 * split across two channels — the icon says which lane above a row came from, the
 * color says whether it is worth stopping at — so a wall of rows can be scanned
 * for trouble rather than read in order. And duration is only drawn where it
 * exists: spans and trace runs get a bar, while logs, metrics and errors are
 * instants and get none.
 */
export function SessionRail({
  items,
  bounds,
  isFiltered,
  isWindowed,
  isPending,
  isError,
  dateParams,
}: Props) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggleGroup(key: string) {
    setExpanded(current => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  // The bar is scaled to the longest thing on screen, so it compares items with
  // each other rather than against the session, where a 40ms span would be
  // invisible.
  const maxDuration = useMemo(
    () =>
      items.reduce((max, item) => Math.max(max, positionOf(item).duration ?? 0), 0) ||
      undefined,
    [items]
  );

  if (isError) {
    return (
      <Status>
        <LoadingError message={t('Failed to load session telemetry.')} />
      </Status>
    );
  }

  if (isPending) {
    return (
      <Status>
        <LoadingIndicator />
      </Status>
    );
  }

  if (items.length === 0) {
    return (
      <Status>
        <Text variant="muted" size="sm">
          {isWindowed
            ? t('Nothing in the selected time range.')
            : isFiltered
              ? t('No telemetry matches these filters.')
              : t('No telemetry found for this session.')}
        </Text>
      </Status>
    );
  }

  return (
    <Rail>
      {items.map((item, index) => {
        if (item.kind === 'event') {
          return (
            <EventRow
              key={`event-${index}`}
              event={item.event}
              bounds={bounds}
              dateParams={dateParams}
              maxDuration={maxDuration}
            />
          );
        }

        const key = groupKey(item.group);
        const isExpanded = expanded.has(key);
        return (
          <Fragment key={`trace-${index}`}>
            <TraceRow
              group={item.group}
              bounds={bounds}
              isExpanded={isExpanded}
              maxDuration={maxDuration}
              onToggle={() => toggleGroup(key)}
            />
            {isExpanded &&
              item.group.spans.map((span, spanIndex) => (
                <EventRow
                  key={`${key}-${spanIndex}`}
                  event={span}
                  bounds={bounds}
                  dateParams={dateParams}
                  maxDuration={maxDuration}
                  isNested
                />
              ))}
          </Fragment>
        );
      })}
    </Rail>
  );
}

/**
 * A run of same-trace spans. It links to the trace rather than to any single
 * span, and its disclosure sits at the far end of the row — as far from that link
 * as the row goes, since the two do very different things and a 20px miss between
 * them used to cost a page navigation.
 */
function TraceRow({
  group,
  bounds,
  isExpanded,
  maxDuration,
  onToggle,
}: {
  bounds: SessionRange | undefined;
  group: SessionTraceGroup;
  isExpanded: boolean;
  maxDuration: number | undefined;
  onToggle: () => void;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const leadingSpan = group.spans[0]!;
  const link = getTraceLink(leadingSpan.row, {organization, location});

  return (
    <Row
      data-expandable
      onClick={event => {
        // The row is a wider target for the chevron rather than a control of its
        // own: anything inside it that already does something keeps doing it, and
        // the chevron remains what a screen reader and the keyboard address.
        if (event.target instanceof Element && event.target.closest('a, button')) {
          return;
        }
        onToggle();
      }}
    >
      <Offset timestamp={group.timestamp} bounds={bounds} />
      <Spine>
        <SpineLine />
        {/* A trace run is spans, and it takes their marker. */}
        <Marker type="spans" variant="muted" />
      </Spine>
      <Body
        variant="muted"
        kind={t('Trace')}
        title={t('Trace %s', getShortEventId(group.trace))}
        tooltip={group.trace}
        detail={tn('%s span', '%s spans', group.spans.length)}
        link={link}
        duration={group.duration}
        maxDuration={maxDuration}
      />
      <Meta duration={group.duration} />
      <ToggleCell>
        <Button
          size="zero"
          variant="transparent"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t('Collapse trace') : t('Expand trace')}
          onClick={onToggle}
          icon={<IconChevron direction={isExpanded ? 'up' : 'down'} size="xs" />}
        />
      </ToggleCell>
    </Row>
  );
}

function EventRow({
  event,
  bounds,
  dateParams,
  maxDuration,
  isNested,
}: {
  bounds: SessionRange | undefined;
  dateParams: Record<string, any>;
  event: SessionEvent;
  maxDuration: number | undefined;
  isNested?: boolean;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const config = DATASET_BY_KEY[event.key];
  const link = ROW_CONFIG[event.key].getLink(event.row, {
    organization,
    location,
    dateParams,
  });
  const variant = severityVariant(event);

  return (
    <Row>
      <Offset timestamp={event.timestamp} bounds={bounds} />
      <Spine>
        <SpineLine />
        {/*
          Nested spans show no marker: they already sit under their trace's, and a
          second one would read as a peer of the rows above and below.
        */}
        {!isNested && <Marker type={event.key} variant={variant} />}
      </Spine>
      <Body
        variant={variant}
        // Only a log's level is worth escalating in text. An error's reads
        // `error`, which the icon and the label have already said twice.
        detailVariant={event.key === 'logs' ? variant : 'muted'}
        kind={config.singularLabel}
        title={event.title}
        tooltip={event.title}
        detail={event.detail}
        link={link}
        duration={event.duration}
        maxDuration={maxDuration}
        isNested={isNested}
      />
      <Meta duration={event.duration} />
      <ToggleCell />
    </Row>
  );
}

/**
 * The row's marker: the lane icon for its type, in the color of its severity.
 * Paints the row's own background behind itself, so the spine reads as passing
 * behind the icon instead of through it.
 */
function Marker({type, variant}: {type: SessionDatasetKey; variant: SeverityVariant}) {
  return (
    <MarkerWrap>
      <TelemetryTypeIcon type={type} size="sm" variant={variant} />
    </MarkerWrap>
  );
}

/**
 * The leading column: how far into the session this row is. Absolute wall-clock
 * time is one hover away, which is the right way round — every row in a session
 * shares the same date and hour.
 */
function Offset({
  timestamp,
  bounds,
}: {
  bounds: SessionRange | undefined;
  timestamp: number | undefined;
}) {
  if (timestamp === undefined || bounds === undefined) {
    return (
      <OffsetCell>
        <Text variant="muted" size="sm" tabular>
          {'—'}
        </Text>
      </OffsetCell>
    );
  }

  return (
    <OffsetCell>
      <InfoText
        title={<DateTime date={timestamp} seconds timeZone />}
        variant="muted"
        size="sm"
        tabular
      >
        {formatOffset(timestamp - bounds.start)}
      </InfoText>
    </OffsetCell>
  );
}

function Body({
  variant,
  detailVariant = 'muted',
  kind,
  title,
  tooltip,
  detail,
  link,
  duration,
  maxDuration,
  isNested,
}: {
  kind: string;
  maxDuration: number | undefined;
  title: string;
  tooltip: string;
  variant: SeverityVariant;
  detail?: string;
  detailVariant?: SeverityVariant;
  duration?: number;
  isNested?: boolean;
  link?: LocationDescriptor;
}) {
  const theme = useTheme();

  return (
    <BodyCell data-nested={isNested}>
      {link ? (
        // `variant="inherit"` matters: Text otherwise paints content.primary and
        // swallows the anchor's accent color, leaving the link looking like plain
        // text.
        <TruncatedLink to={link}>
          <Text ellipsis size="sm" variant="inherit" title={tooltip}>
            {title}
          </Text>
        </TruncatedLink>
      ) : (
        <Text ellipsis size="sm" title={tooltip}>
          {title}
        </Text>
      )}
      <Flex align="center" gap="xs" minWidth="0">
        <KindLabel size="xs" variant={variant}>
          {kind}
        </KindLabel>
        {detail && (
          <Text size="xs" variant={detailVariant} ellipsis>
            {detail}
          </Text>
        )}
      </Flex>
      {duration !== undefined && maxDuration !== undefined && (
        <DurationBar aria-hidden>
          <span
            style={{
              width: `${Math.max(2, (duration / maxDuration) * 100)}%`,
              background: graphicsColor(variant, theme),
            }}
          />
        </DurationBar>
      )}
    </BodyCell>
  );
}

function Meta({duration}: {duration: number | undefined}) {
  return (
    <MetaCell>
      {duration === undefined ? null : (
        <Text size="xs" variant="muted" tabular>
          {formatDurationMs(duration)}
        </Text>
      )}
    </MetaCell>
  );
}

const Status = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space['3xl']} ${p => p.theme.space.xl};
`;

const Rail = styled('ul')`
  display: flex;
  flex-direction: column;
  padding: ${p => p.theme.space.md} 0;
  margin: 0;
  list-style: none;
`;

/**
 * The offset column is sized to the widest thing it holds — `0:00.00` and its
 * hour-long form — rather than to a round number, and the row's own padding stays
 * narrow. Between them they used to open a gap wide enough to read as a margin,
 * which pushed the whole rail away from the panel edge it belongs against.
 */
const Row = styled('li')`
  display: grid;
  grid-template-columns: 48px 20px minmax(0, 1fr) auto 24px;
  column-gap: ${p => p.theme.space.md};
  align-items: stretch;
  padding: 0 ${p => p.theme.space.lg};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:hover a {
    text-decoration: underline;
  }

  /* A row that expands where you click it has to look like it does. */
  &[data-expandable] {
    cursor: pointer;
  }
`;

const OffsetCell = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${p => p.theme.space.xs} 0;
`;

/**
 * The spine: one continuous hairline down the rail with the row's marker on top
 * of it. The line lives in the row rather than in the container so it cannot
 * drift out of alignment with the markers.
 */
const Spine = styled('div')`
  position: relative;
  display: flex;
  justify-content: center;
`;

const SpineLine = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  margin-left: -0.5px;
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

const MarkerWrap = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: ${p => p.theme.space['2xs']};
  background: ${p => p.theme.tokens.background.primary};

  ${Row}:hover & {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const ToggleCell = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: ${p => p.theme.space['2xs']} 0;
`;

const BodyCell = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  padding: ${p => p.theme.space.xs} 0;

  &[data-nested='true'] {
    padding-left: ${p => p.theme.space.md};
  }
`;

const KindLabel = styled(Text)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
`;

const DurationBar = styled('div')`
  position: relative;
  height: 3px;
  width: 140px;
  max-width: 40%;
  margin-top: ${p => p.theme.space['2xs']};
  border-radius: ${p => p.theme.radius.full};
  background: ${p => p.theme.tokens.graphics.neutral.muted};

  span {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    border-radius: ${p => p.theme.radius.full};
  }
`;

const MetaCell = styled('div')`
  display: flex;
  align-items: flex-start;
  padding: ${p => p.theme.space.xs} 0;
  white-space: nowrap;
`;

/**
 * An anchor is a flex item with `min-width: auto`, so it refuses to shrink below
 * its text and overflows the cell. Zeroing that hands the truncation back to the
 * `Text` inside.
 */
const TruncatedLink = styled(Link)`
  min-width: 0;
`;
