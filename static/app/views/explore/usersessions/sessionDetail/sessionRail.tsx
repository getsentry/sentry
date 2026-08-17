import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

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
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import {getTraceLink, ROW_CONFIG} from './rowConfig';
import {formatDurationMs, formatOffset} from './sessionTime';
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
 * Shortest run of nothing that is worth collapsing, and the fraction of the
 * session a gap has to reach to count as one.
 *
 * A fixed threshold cannot serve both a four-second session and a four-hour one:
 * five seconds is most of the first and noise in the second. Scaling with the
 * session keeps roughly the same handful of breaks either way.
 */
const MIN_QUIET_MS = 2000;
const QUIET_FRACTION = 1 / 50;

interface Props {
  /** Session extent, which every offset is measured from. */
  bounds: SessionRange | undefined;
  /** Whether runs of nothing collapse into a single break. */
  collapseQuiet: boolean;
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
 * The session read top to bottom: one row per telemetry item, offsets relative to
 * the session start, and a colored dot per type on a continuous spine.
 *
 * Two things separate this from the flat table it replaces. Dead time is drawn as
 * dead time — a run of nothing collapses into one labelled break, so scroll
 * distance tracks activity instead of row count. And duration is only drawn where
 * it exists: spans and trace runs get a bar, while logs, metrics and errors are
 * instants and get none.
 */
export function SessionRail({
  items,
  bounds,
  collapseQuiet,
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

  const quietThreshold = bounds
    ? Math.max(MIN_QUIET_MS, (bounds.end - bounds.start) * QUIET_FRACTION)
    : MIN_QUIET_MS;

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
        const {timestamp} = positionOf(item);
        const previous = index === 0 ? undefined : positionOf(items[index - 1]!);
        // Signless: the same break reads as quiet time whichever way the rail is
        // sorted.
        const quiet =
          previous?.timestamp === undefined || timestamp === undefined
            ? 0
            : Math.abs(timestamp - previous.timestamp);
        const gap =
          collapseQuiet && quiet >= quietThreshold ? (
            <QuietBreak key={`quiet-${index}`} duration={quiet} />
          ) : null;

        if (item.kind === 'event') {
          return (
            <Fragment key={`event-${index}`}>
              {gap}
              <EventRow
                event={item.event}
                bounds={bounds}
                dateParams={dateParams}
                maxDuration={maxDuration}
              />
            </Fragment>
          );
        }

        const key = groupKey(item.group);
        const isExpanded = expanded.has(key);
        return (
          <Fragment key={`trace-${index}`}>
            {gap}
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
 * span, and takes the chevron in place of a dot — the spine stays one column
 * wide, so every title still starts at the same edge.
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
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const leadingSpan = group.spans[0]!;
  const link = getTraceLink(leadingSpan.row, {organization, location});
  const color = theme.tokens.graphics[DATASET_BY_KEY.spans.graphicsVariant].vibrant;

  return (
    <Row>
      <Offset timestamp={group.timestamp} bounds={bounds} />
      <Spine>
        <SpineLine />
        <Chevron
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t('Collapse trace') : t('Expand trace')}
          onClick={onToggle}
          style={{color}}
        >
          <IconChevron direction={isExpanded ? 'down' : 'right'} size="xs" />
        </Chevron>
      </Spine>
      <Body
        color={color}
        kind={t('Trace')}
        title={t('Trace %s', getShortEventId(group.trace))}
        tooltip={group.trace}
        detail={tn('%s span', '%s spans', group.spans.length)}
        link={link}
        duration={group.duration}
        maxDuration={maxDuration}
      />
      <Meta duration={group.duration} />
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
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const config = DATASET_BY_KEY[event.key];
  const link = ROW_CONFIG[event.key].getLink(event.row, {
    organization,
    location,
    dateParams,
  });
  const color = theme.tokens.graphics[config.graphicsVariant].vibrant;

  return (
    <Row>
      <Offset timestamp={event.timestamp} bounds={bounds} />
      <Spine>
        <SpineLine />
        {/*
          Nested spans show no dot: they already sit under their trace's chevron,
          and a dot would read as a peer of the rows above and below.
        */}
        {!isNested && (
          <DotWrap>
            <Dot
              style={{background: color, color}}
              data-hollow={event.key === 'metrics'}
            />
          </DotWrap>
        )}
      </Spine>
      <Body
        color={color}
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
    </Row>
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
  color,
  kind,
  title,
  tooltip,
  detail,
  link,
  duration,
  maxDuration,
  isNested,
}: {
  color: string;
  kind: string;
  maxDuration: number | undefined;
  title: string;
  tooltip: string;
  detail?: string;
  duration?: number;
  isNested?: boolean;
  link?: LocationDescriptor;
}) {
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
        <KindLabel style={{color}}>{kind}</KindLabel>
        {detail && (
          <Text size="xs" variant="muted" ellipsis>
            {detail}
          </Text>
        )}
      </Flex>
      {duration !== undefined && maxDuration !== undefined && (
        <DurationBar aria-hidden>
          <span
            style={{
              width: `${Math.max(2, (duration / maxDuration) * 100)}%`,
              background: color,
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

/**
 * A run of nothing, drawn as a run of nothing. This is the point of the rail: in
 * a table, ninety idle seconds and two back-to-back spans look identical, and the
 * idle stretch is often the more informative of the two.
 */
function QuietBreak({duration}: {duration: number}) {
  return (
    // A separator rather than a list item: nothing happened here, so it is a
    // break between items rather than one of them.
    <Row role="separator">
      <OffsetCell />
      <Spine>
        <SpineLine data-dashed />
      </Spine>
      <QuietCell>
        <Text size="xs" variant="muted" tabular>
          {t('%s quiet', formatDurationMs(duration))}
        </Text>
        <QuietRule />
      </QuietCell>
    </Row>
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

const Row = styled('li')`
  display: grid;
  grid-template-columns: 72px 20px minmax(0, 1fr) auto;
  column-gap: ${p => p.theme.space.md};
  align-items: stretch;
  padding: 0 ${p => p.theme.space.xl};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:hover a {
    text-decoration: underline;
  }

  /* A quiet break is not a row you can act on, so it does not respond like one. */
  &[role='separator']:hover {
    background: none;
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
 * drift out of alignment with the dots.
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

  &[data-dashed] {
    border-left-style: dashed;
  }
`;

/**
 * Paints the row's own background behind the marker, so the spine reads as
 * passing behind the dot instead of through it.
 */
const DotWrap = styled('div')`
  position: relative;
  margin-top: 6px;
  padding: 3px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.primary};

  ${Row}:hover & {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;

const Dot = styled('div')`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;

  /* Metrics read as measurements rather than events, so their marker is open. */
  &[data-hollow='true'] {
    box-shadow: inset 0 0 0 2px currentColor;
    background: transparent !important;
  }
`;

const Chevron = styled('button')`
  position: relative;
  margin-top: 4px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: ${p => p.theme.radius.xs};
  cursor: pointer;
  background: ${p => p.theme.tokens.background.primary};

  ${Row}:hover & {
    background: ${p => p.theme.tokens.background.secondary};
  }
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

const KindLabel = styled('span')`
  font-size: ${p => p.theme.font.size.xs};
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

const QuietCell = styled('div')`
  grid-column: 3 / -1;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.xs} 0;
`;

const QuietRule = styled('div')`
  flex: 1;
  height: 1px;
  background: repeating-linear-gradient(
    to right,
    ${p => p.theme.tokens.graphics.neutral.muted} 0 3px,
    transparent 3px 7px
  );
`;

/**
 * An anchor is a flex item with `min-width: auto`, so it refuses to shrink below
 * its text and overflows the cell. Zeroing that hands the truncation back to the
 * `Text` inside.
 */
const TruncatedLink = styled(Link)`
  min-width: 0;
`;
