import {useEffect, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import {itemKey} from './itemKey';
import {formatDurationMs, formatOffset} from './sessionTime';
import type {SeverityVariant} from './severity';
import {graphicsColor, severityVariant} from './severity';
import {TelemetryTypeIcon} from './telemetryTypeIcon';
import type {SessionEvent, SessionRange} from './useSessionDetail';

const DATASET_BY_KEY = Object.fromEntries(
  SESSION_DATASETS.map(config => [config.key, config])
) as Record<SessionDatasetKey, (typeof SESSION_DATASETS)[number]>;

interface Props {
  /** Session extent, which every offset is measured from. */
  bounds: SessionRange | undefined;
  isError: boolean;
  /** True when a filter is hiding rows, which changes what an empty rail means. */
  isFiltered: boolean;
  isPending: boolean;
  /** True when a scrubber selection is narrowing the rail. */
  isWindowed: boolean;
  items: SessionEvent[];
  /** Opens the details panel for a row. */
  onSelect: (key: string) => void;
  /** The row whose details are open, which may not be one of `items`. */
  selectedKey: string | null;
}

/**
 * The session read top to bottom: one row per telemetry item, offsets relative to
 * the session start, and the item's own icon on a continuous spine.
 *
 * Two things separate this from the flat table it replaces. Type and severity are
 * split across two channels — the icon says which lane above a row came from, the
 * color says whether it is worth stopping at — so a wall of rows can be scanned
 * for trouble rather than read in order. And duration is only drawn where it
 * exists: a trace gets a bar, while logs, metrics and errors are instants and get
 * none.
 *
 * A row is the way into the details panel: clicking anywhere in it selects the
 * item, which opens the panel and marks the item in the swim lanes above. Nothing
 * in a row navigates, so a mis-click costs a panel rather than the page.
 */
export function SessionRail({
  items,
  bounds,
  isFiltered,
  isWindowed,
  isPending,
  isError,
  selectedKey,
  onSelect,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // The bar is scaled to the longest thing on screen, so it compares items with
  // each other rather than against the session, where a 40ms trace would be
  // invisible.
  const maxDuration = useMemo(
    () => items.reduce((max, item) => Math.max(max, item.duration ?? 0), 0) || undefined,
    [items]
  );

  /**
   * Only the rows in view are mounted. A session runs to four thousand items and
   * every row carries a link, a tooltip and a button, so rendering the list whole
   * cost tens of thousands of components — and paid for them again on every
   * selection, filter and scrubber drag.
   *
   * Measured rather than assumed: a trace row draws a duration bar that the
   * instants do not, so the rows are two heights, and `estimateSize` is only the
   * opening guess for rows that have not been on screen yet.
   */
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 12,
  });

  /**
   * Where the open item sits in the list, so a selection made somewhere other
   * than the rail — a marker in the scrubber, a link into the page — can be
   * revealed. It is an index rather than a node now: the selected row is
   * frequently not mounted, which is exactly the case a scroll into view has to
   * handle.
   */
  const selectedIndex = useMemo(
    () =>
      selectedKey === null ? -1 : items.findIndex(item => itemKey(item) === selectedKey),
    [items, selectedKey]
  );

  useEffect(() => {
    if (selectedIndex >= 0) {
      virtualizer.scrollToIndex(selectedIndex, {align: 'auto'});
    }
  }, [selectedIndex, virtualizer]);

  const content = isError ? (
    <Status>
      <LoadingError message={t('Failed to load session telemetry.')} />
    </Status>
  ) : isPending ? (
    <Status>
      <LoadingIndicator />
    </Status>
  ) : items.length === 0 ? (
    <Status>
      <Text variant="muted" size="sm">
        {isWindowed
          ? t('Nothing in the selected time range.')
          : isFiltered
            ? t('No telemetry matches these filters.')
            : t('No telemetry found for this session.')}
      </Text>
    </Status>
  ) : (
    <Rail style={{height: virtualizer.getTotalSize()}}>
      {virtualizer.getVirtualItems().map(row => {
        const item = items[row.index]!;
        const key = itemKey(item);
        return (
          <EventRow
            key={row.key}
            index={row.index}
            ref={virtualizer.measureElement}
            style={{transform: `translateY(${row.start}px)`}}
            event={item}
            bounds={bounds}
            maxDuration={maxDuration}
            isSelected={key !== undefined && key === selectedKey}
            onSelect={key === undefined ? undefined : () => onSelect(key)}
          />
        );
      })}
    </Rail>
  );

  // The scroller is always the rail's root, empty states included, so the panel
  // keeps one height and the page below it never moves.
  return (
    <RailScroller ref={scrollRef} data-test-id="session-rail">
      {content}
    </RailScroller>
  );
}

/**
 * Opening guess at a row's height: two lines of text plus the cell padding. Rows
 * are measured once they mount, so this only has to be close enough that the
 * scrollbar does not lurch on first paint.
 */
const ROW_ESTIMATE = 46;

function EventRow({
  ref,
  index,
  style,
  event,
  bounds,
  maxDuration,
  isSelected,
  onSelect,
}: {
  bounds: SessionRange | undefined;
  event: SessionEvent;
  /** Position in the full list. The virtualizer reads it back off the DOM to measure. */
  index: number;
  isSelected: boolean;
  maxDuration: number | undefined;
  onSelect?: () => void;
  ref?: React.Ref<HTMLLIElement>;
  style?: React.CSSProperties;
}) {
  const config = DATASET_BY_KEY[event.key];
  const variant = severityVariant(event);

  return (
    <SelectableRow
      ref={ref}
      index={index}
      style={style}
      isSelected={isSelected}
      onSelect={onSelect}
    >
      <Offset timestamp={event.timestamp} bounds={bounds} />
      <Spine>
        <SpineLine />
        <Marker type={event.key} variant={variant} />
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
        duration={event.duration}
        maxDuration={maxDuration}
      />
      <Meta duration={event.duration} />
    </SelectableRow>
  );
}

/**
 * The row as a selection target, and the button that makes that reachable without
 * a pointer.
 *
 * The row is the wide target and the button is what the keyboard and a screen
 * reader address — the same split the logs explorer uses for its expandable rows.
 * The guard keeps the row's handler off anything that already has one of its own,
 * which is now just the panel button — without it the button would toggle the
 * selection twice.
 *
 * Both toggle, so the row that opened the panel is also what closes it.
 */
function SelectableRow({
  ref,
  index,
  style,
  isSelected,
  onSelect,
  children,
}: {
  children: React.ReactNode;
  index: number;
  isSelected: boolean;
  onSelect: (() => void) | undefined;
  ref?: React.Ref<HTMLLIElement>;
  style?: React.CSSProperties;
}) {
  return (
    <Row
      ref={ref}
      data-index={index}
      style={style}
      aria-current={isSelected ? true : undefined}
      data-selected={isSelected}
      data-selectable={onSelect ? true : undefined}
      onClick={event => {
        if (!onSelect) {
          return;
        }
        if (event.target instanceof Element && event.target.closest('a, button')) {
          return;
        }
        onSelect();
      }}
    >
      {children}
      <ActionCell>
        {onSelect && (
          <Button
            size="zero"
            variant="transparent"
            aria-pressed={isSelected}
            aria-label={isSelected ? t('Hide details') : t('Show details')}
            onClick={onSelect}
            icon={<IconPanel direction="right" size="xs" />}
          />
        )}
      </ActionCell>
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
  duration,
  maxDuration,
}: {
  kind: string;
  maxDuration: number | undefined;
  title: string;
  tooltip: string;
  variant: SeverityVariant;
  detail?: string;
  detailVariant?: SeverityVariant;
  duration?: number;
}) {
  const theme = useTheme();

  return (
    <BodyCell>
      {/*
        Plain text, not a link. The row's whole job is to open the details panel,
        and a title that navigated away instead made the most obvious thing to
        click the one that left the page — easy to hit by accident, and the
        session is the context you were reading it in. The deep link out lives in
        the panel, behind a labelled button that says where it goes.
      */}
      <Text ellipsis size="sm" title={tooltip}>
        {title}
      </Text>
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

/**
 * The rail's own scroll container, which is what makes the page around it stand
 * still: the session's header, its chart and its filters stay put while only the
 * list moves, and the window itself never scrolls.
 */
const RailScroller = styled('div')`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: ${p => p.theme.space.md} 0;
`;

/**
 * Sized to the whole list rather than to the rows in it: the height is the
 * virtualizer's total, and each row is absolutely positioned inside it, so the
 * scrollbar describes every item while only a screenful is mounted.
 */
const Rail = styled('ul')`
  position: relative;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
`;

/**
 * The offset column is sized to the widest thing it holds — `0:00.00` and its
 * hour-long form — rather than to a round number, and the row's own padding stays
 * narrow. Between them they used to open a gap wide enough to read as a margin,
 * which pushed the whole rail away from the panel edge it belongs against.
 *
 * Selected is an opaque background rather than a tint, so the marker behind the
 * spine can match it exactly, plus an accent edge that hover has no version of.
 */
const Row = styled('li')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: grid;
  grid-template-columns: 48px 20px minmax(0, 1fr) auto 24px;
  column-gap: ${p => p.theme.space.md};
  align-items: stretch;
  padding: 0 ${p => p.theme.space.lg};

  &[data-selectable] {
    cursor: pointer;
  }

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }

  &[data-selected='true'],
  &[data-selected='true']:hover {
    background: ${p => p.theme.tokens.background.tertiary};
    box-shadow: inset 3px 0 0 0 ${p => p.theme.tokens.graphics.accent.vibrant};
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

  ${Row}[data-selected='true'] & {
    background: ${p => p.theme.tokens.background.tertiary};
  }
`;

/**
 * The details button's cell. It stays quiet until the row is hovered or the button
 * is focused, so a screenful of rows doesn't read as a column of buttons — but a
 * selected row keeps it visible, since that button is also the way to close.
 */
const ActionCell = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: ${p => p.theme.space['2xs']} 0;
  opacity: 0;

  ${Row}:hover &,
  ${Row}[data-selected='true'] &,
  &:focus-within {
    opacity: 1;
  }
`;

const BodyCell = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  padding: ${p => p.theme.space.xs} 0;
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
