import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PerformanceDuration} from 'sentry/components/performanceDuration';
import {
  COL_WIDTH_MINIMUM,
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {useStateBasedColumnResize} from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import {TimeSince} from 'sentry/components/timeSince';
import {IconFire, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCtrlKeyPressed} from 'sentry/utils/isCtrlKeyPressed';
import {markdownToPlainText} from 'sentry/utils/marked/marked';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {isUUID} from 'sentry/utils/string/isUUID';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {useConversationDirectHitRedirect} from 'sentry/views/explore/conversations/hooks/useConversationDirectHitRedirect';
import {
  useConversations,
  type Conversation,
  type ConversationUser,
} from 'sentry/views/explore/conversations/hooks/useConversations';
import {getConversationDetailUrl} from 'sentry/views/explore/conversations/utils/urlParams';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';

// Tool tags wrap across at most this many rows; anything that doesn't fit
// collapses into a trailing "+N" overflow tag.
const MAX_TOOL_ROWS = 2;

// Floor for a truncated tool tag so it never collapses to nothing when the
// column is extremely narrow.
const MIN_TOOL_TAG_WIDTH = 40;

// Slack (px) subtracted from a tag's max-width so sub-pixel rounding never
// wraps the trailing "+N" badge onto a second line.
const TAG_WIDTH_SLACK = 2;

// Fixed height for each data row.
const ROW_HEIGHT = 63;

type ColumnKey =
  | 'conversation'
  | 'duration'
  | 'messages'
  | 'errors'
  | 'cost'
  | 'tools'
  | 'age';

const COLUMN_ORDER: ColumnKey[] = [
  'conversation',
  'duration',
  'messages',
  'errors',
  'cost',
  'tools',
  'age',
];

// `conversation` is the flexible growth column (COL_WIDTH_UNDEFINED); the rest
// have sensible starting widths that the user can drag to resize.
const COLUMN_DEFAULTS: Record<ColumnKey, {name: string; width: number}> = {
  conversation: {name: t('Conversation'), width: COL_WIDTH_UNDEFINED},
  duration: {name: t('Duration'), width: 120},
  messages: {name: t('Messages'), width: 120},
  errors: {name: t('Errors'), width: 100},
  cost: {name: t('Cost'), width: 120},
  tools: {name: t('Tools'), width: 220},
  age: {name: t('Age'), width: 110},
};

const RIGHT_ALIGNED_COLUMNS = new Set<ColumnKey>(['age']);

// Plain-text title/first-message is ellipsized to this length before rendering.
const CELL_MAX_CHARS = 256;

export function normalizeUserField(value: string | null | undefined): string | null {
  if (!value || value.toLowerCase() === 'none') {
    return null;
  }
  return value;
}

export function getUserDisplayName(user: ConversationUser): string | null {
  return (
    normalizeUserField(user.email) ||
    normalizeUserField(user.username) ||
    normalizeUserField(user.ip_address) ||
    normalizeUserField(user.id) ||
    null
  );
}

export function UserNotInstrumentedTooltip() {
  return (
    <Text>
      {tct(
        'User data not found. Call [code:sentry.setUser()] in your SDK to track users. [link:Learn more]',
        {
          code: <code />,
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/apis/#setUser" />
          ),
        }
      )}
    </Text>
  );
}

/**
 * When no conversation on the page has tools, the tools column only ever renders
 * a placeholder, so collapse it to the grid's minimum width and let the flexible
 * conversation column absorb the freed space. This only kicks in while the column
 * is still at its default width — once the user has resized it we respect their
 * choice and leave it alone. The passed-in resize state is never mutated, so the
 * column returns to its default width once a page with tools loads.
 */
export function collapseToolsColumnWhenUnused(
  columnOrder: Array<GridColumnOrder<ColumnKey>>,
  hasNoTools: boolean
): Array<GridColumnOrder<ColumnKey>> {
  const toolsColumn = columnOrder.find(column => column.key === 'tools');
  const toolsColumnAtDefault = toolsColumn?.width === COLUMN_DEFAULTS.tools.width;
  if (!hasNoTools || !toolsColumnAtDefault) {
    return columnOrder;
  }
  return columnOrder.map(column =>
    column.key === 'tools' ? {...column, width: COL_WIDTH_MINIMUM} : column
  );
}

export function ConversationsTable() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const {data, isFetching, error, pageLinks, setCursor, isDirectHit} = useConversations();
  useConversationDirectHitRedirect({isDirectHit, conversations: data});

  const [highlightedRowKey, setHighlightedRowKey] = useState<number | undefined>();

  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize<
    GridColumnOrder<ColumnKey>
  >({
    columns: () =>
      COLUMN_ORDER.map(key => ({
        key,
        name: COLUMN_DEFAULTS[key].name,
        width: COLUMN_DEFAULTS[key].width,
      })),
  });

  const hasNoTools = useMemo(
    () =>
      data.length > 0 && data.every(conversation => conversation.toolNames.length === 0),
    [data]
  );

  const displayedColumns = useMemo(
    () => collapseToolsColumnWhenUnused(columnOrder, hasNoTools),
    [columnOrder, hasNoTools]
  );

  const handlePaginate: typeof setCursor = (cursor, path, query, pageDelta) => {
    trackAnalytics('conversations.table.paginate', {
      organization,
      direction: pageDelta > 0 ? 'next' : 'previous',
    });
    setCursor(cursor, path, query, pageDelta);
  };

  const handleRowClick = useCallback(
    (dataRow: Conversation, _key: number, event: React.MouseEvent) => {
      const url = getConversationDetailUrl(
        organization.slug,
        dataRow,
        selection.projects
      );
      // Mirror native link behavior instead of navigating in place: Cmd/Ctrl+click
      // opens a new tab (no features string) and Shift+click opens a new window
      // (a features string makes browsers open a window rather than a tab).
      if (event.shiftKey) {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (isCtrlKeyPressed(event)) {
        window.open(url, '_blank');
        return;
      }
      navigate(url);
    },
    [navigate, organization.slug, selection.projects]
  );

  const renderHeadCell = useCallback(
    (column: GridColumnHeader<ColumnKey>) => (
      <Flex
        flex="1"
        align="center"
        gap="xs"
        justify={RIGHT_ALIGNED_COLUMNS.has(column.key) ? 'end' : 'start'}
      >
        {column.name}
        {/* Raise the conversation column's growth-limit so it absorbs the
            leftover width instead of the last column stretching. */}
        {column.key === 'conversation' && <Container width="100vw" />}
      </Flex>
    ),
    []
  );

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<ColumnKey>, dataRow: Conversation) => (
      <BodyCell column={column} conversation={dataRow} />
    ),
    []
  );

  return (
    <Stack gap="lg">
      <FixedRowHeightGrid>
        <GridEditable
          isLoading={isFetching}
          error={error}
          data={data}
          columnOrder={displayedColumns}
          columnSortBy={[]}
          stickyHeader
          // GridEditable's Panel body has a default bottom margin; drop it so
          // the Stack's `lg` gap is the only spacing before the pagination.
          bodyStyle={{marginBottom: 0}}
          grid={{
            renderHeadCell,
            renderBodyCell,
            onResizeColumn: handleResizeColumn,
          }}
          onRowClick={handleRowClick}
          isRowClickable={() => true}
          onRowMouseOver={(_dataRow, key) => setHighlightedRowKey(key)}
          onRowMouseOut={() => setHighlightedRowKey(undefined)}
          highlightedRowKey={highlightedRowKey}
        />
      </FixedRowHeightGrid>
      {/* Zero Pagination's built-in top margin so the Stack's `lg` gap is the
          only spacing between the table and the controls. */}
      <TablePagination pageLinks={pageLinks} onCursor={handlePaginate} />
    </Stack>
  );
}

function BodyCell({
  column,
  conversation,
}: {
  column: GridColumnOrder<ColumnKey>;
  conversation: Conversation;
}) {
  switch (column.key) {
    case 'conversation':
      return <ConversationCell conversation={conversation} />;
    case 'duration':
      return (
        <Text tabular>
          <PerformanceDuration
            milliseconds={conversation.generationDuration}
            abbreviation
          />
        </Text>
      );
    case 'messages':
      return (
        <Text tabular>
          <Count value={conversation.llmCalls} />
        </Text>
      );
    case 'errors':
      return <ErrorsCell errors={conversation.errors} />;
    case 'cost':
      return (
        <Text tabular>
          {conversation.totalCost !== null && conversation.totalCost < 0 ? (
            <NegativeCostInfo cost={conversation.totalCost} />
          ) : (
            <LLMCosts cost={conversation.totalCost} />
          )}
        </Text>
      );
    case 'tools':
      return <ToolsCell toolNames={conversation.toolNames} />;
    case 'age':
      return (
        <Text align="right" variant="muted">
          <TimeSince unitStyle="extraShort" date={conversation.endTimestamp} />
        </Text>
      );
    default:
      return null;
  }
}

function getConversationTitle(
  title: string | null,
  firstInput: string | null
): string | null {
  // Prefer the AI-generated title, falling back to the first user message. Both
  // can contain markdown/tags and are rendered as plain Text, so flatten them to
  // a single line; a value that flattens to nothing falls back to the caller's
  // placeholder rather than showing a blank title.
  const raw = title ?? firstInput;
  if (!raw) {
    return null;
  }
  const plainText = ellipsize(
    markdownToPlainText(raw).replace(/\s+/g, ' ').trim(),
    CELL_MAX_CHARS
  );
  return plainText.length > 0 ? plainText : null;
}

function getConversationIdLabel(conversationId: string): string {
  // UUIDs are long and opaque, so show a short prefix; other id formats
  // (e.g. `resp_...`, `slack:1234`) are already short enough.
  return isUUID(conversationId) ? conversationId.slice(0, 8) : conversationId;
}

function ConversationCell({conversation}: {conversation: Conversation}) {
  // Flattening markdown to plain text renders HTML + parses it, so memoize on
  // the inputs to avoid recomputing on unrelated re-renders (hover, resize).
  const title = useMemo(
    () => getConversationTitle(conversation.title, conversation.firstInput),
    [conversation.title, conversation.firstInput]
  );
  const project = useProjectFromId({
    project_id: conversation.projectId ? String(conversation.projectId) : undefined,
  });

  return (
    <Stack gap="xs" minWidth={0}>
      <Text size="lg" ellipsis>
        {title ?? <Text variant="muted">{t('Untitled conversation')}</Text>}
      </Text>
      <Flex align="center" gap="sm" minWidth={0}>
        <Flex align="center" gap="xs" minWidth={0}>
          {project && (
            <ProjectAvatar
              project={project}
              size={14}
              hasTooltip
              tooltip={project.slug}
            />
          )}
          <Text size="sm" variant="muted" ellipsis>
            {getConversationIdLabel(conversation.conversationId)}
          </Text>
        </Flex>
        <CellDivider orientation="vertical" />
        <ConversationUserLabel user={conversation.user} />
      </Flex>
    </Stack>
  );
}

function ConversationUserLabel({user}: {user: Conversation['user']}) {
  const displayName = user ? getUserDisplayName(user) : null;

  if (displayName) {
    return (
      <Flex align="center" gap="xs" minWidth={0}>
        <UserIcon size="xs" />
        <Text size="sm" variant="muted" ellipsis>
          {displayName}
        </Text>
      </Flex>
    );
  }

  return (
    <Tooltip title={<UserNotInstrumentedTooltip />} isHoverable skipWrapper>
      <Flex align="center" gap="xs">
        <UserIcon size="xs" />
        <Text size="sm" variant="muted">
          &mdash;
        </Text>
      </Flex>
    </Tooltip>
  );
}

function ErrorsCell({errors}: {errors: number}) {
  if (errors === 0) {
    return (
      <Text tabular variant="muted">
        0
      </Text>
    );
  }
  return (
    <Flex align="center" gap="xs">
      <Text tabular variant="danger">
        <Count value={errors} />
      </Text>
      <IconFire size="xs" variant="danger" />
    </Flex>
  );
}

/**
 * Greedily packs tool tags into up to `maxRows` rows and returns how many are
 * visible. When they don't all fit, room is reserved on the last row for the
 * trailing "+N" overflow tag.
 */
export function getVisibleToolCount({
  tagWidths,
  badgeWidth,
  gap,
  containerWidth,
  maxRows,
}: {
  badgeWidth: number;
  containerWidth: number;
  gap: number;
  maxRows: number;
  tagWidths: number[];
}): number {
  const totalTags = tagWidths.length;

  // Whether the first `tagCount` tags — plus the overflow badge when
  // `withOverflowBadge` — can be laid out within `maxRows`.
  const fitsWithinRows = (tagCount: number, withOverflowBadge: boolean): boolean => {
    const itemWidths = tagWidths.slice(0, tagCount);
    if (withOverflowBadge) {
      itemWidths.push(badgeWidth);
    }

    let rowCount = 1;
    let rowWidth = 0;
    for (const itemWidth of itemWidths) {
      const widthWithGap = rowWidth === 0 ? itemWidth : gap + itemWidth;
      if (rowWidth + widthWithGap <= containerWidth) {
        rowWidth += widthWithGap;
        continue;
      }
      // Doesn't fit on the current row — wrap onto the next one.
      rowCount += 1;
      rowWidth = itemWidth;
      if (rowCount > maxRows) {
        return false;
      }
    }
    return true;
  };

  if (fitsWithinRows(totalTags, false)) {
    return totalTags;
  }

  // Adding a tag never reduces the number of rows needed, so the answer is the
  // largest prefix that still fits alongside the badge — stop at the first that
  // doesn't.
  let visibleCount = 0;
  for (let tagCount = 1; tagCount <= totalTags; tagCount++) {
    if (!fitsWithinRows(tagCount, true)) {
      break;
    }
    visibleCount = tagCount;
  }
  return visibleCount;
}

function ToolsCell({toolNames}: {toolNames: string[]}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: containerRef});

  const [layout, setLayout] = useState<{
    badgeWidth: number;
    gap: number;
    rowHeight: number;
    tagWidths: number[];
  } | null>(null);

  // Tag widths/heights are content-based (independent of the container width),
  // so we only re-measure when the set of tools changes. Join on NUL so tool
  // names containing spaces can't collide into the same key.
  const toolsKey = toolNames.join('\x00');
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) {
      return;
    }
    const tagEls = el.querySelectorAll<HTMLElement>('[data-tool-tag]');
    const badgeEl = el.querySelector<HTMLElement>('[data-tool-badge]');
    setLayout({
      gap: parseFloat(getComputedStyle(el).columnGap) || 0,
      tagWidths: Array.from(tagEls, tag => tag.getBoundingClientRect().width),
      badgeWidth: badgeEl?.getBoundingClientRect().width ?? 0,
      rowHeight: badgeEl?.getBoundingClientRect().height ?? 0,
    });
  }, [toolsKey]);

  const visibleCount = useMemo(() => {
    if (!layout || width === 0) {
      return toolNames.length;
    }
    const fitCount = getVisibleToolCount({
      tagWidths: layout.tagWidths,
      badgeWidth: layout.badgeWidth,
      gap: layout.gap,
      containerWidth: width,
      maxRows: MAX_TOOL_ROWS,
    });
    // Always keep at least one tag visible; if it can't fit it will be
    // truncated (see maxTagWidth below) rather than dropped into the overflow.
    return Math.max(fitCount, 1);
  }, [layout, width, toolNames.length]);

  if (toolNames.length === 0) {
    return <Text variant="muted">&mdash;</Text>;
  }

  const overflowCount = toolNames.length - visibleCount;

  // Cap each tag so a long tool name ellipsizes instead of being clipped. When
  // an overflow badge is present, also reserve room for it so it never wraps.
  // Expressed as a CSS calc against the container width (not the measured JS
  // width) so it tracks resizing synchronously — otherwise the ResizeObserver
  // lag lets the tag/badge flicker onto a second line for a frame. `max()`
  // keeps a floor when the column is narrow.
  const maxTagWidth = layout
    ? overflowCount > 0
      ? `max(${MIN_TOOL_TAG_WIDTH}px, calc(100% - ${
          layout.badgeWidth + layout.gap + TAG_WIDTH_SLACK
        }px))`
      : '100%'
    : undefined;

  // Pin the container to exactly MAX_TOOL_ROWS so a transient reflow during
  // resize can't briefly spill onto another line before the count settles.
  const maxHeight = layout
    ? layout.rowHeight * MAX_TOOL_ROWS + layout.gap * (MAX_TOOL_ROWS - 1)
    : undefined;

  return (
    <ToolsContainer
      ref={containerRef}
      position="relative"
      wrap="wrap"
      gap="xs"
      width="100%"
      minWidth={0}
      overflow="hidden"
      style={maxHeight ? {maxHeight} : undefined}
    >
      {toolNames.slice(0, visibleCount).map((name, index) => (
        <Tag
          key={`${name}-${index}`}
          variant="muted"
          style={maxTagWidth ? {maxWidth: maxTagWidth} : undefined}
        >
          {/* Tag's own text node is display:flex, which breaks text-overflow;
              a block-level Text ellipsizes within it. */}
          <Text ellipsis>{name}</Text>
        </Tag>
      ))}
      {overflowCount > 0 && (
        <Tooltip title={toolNames.slice(visibleCount).join(', ')}>
          <Tag variant="muted">{`+${overflowCount}`}</Tag>
        </Tooltip>
      )}

      {/* Hidden measurement layer: always renders every tag so their intrinsic
          widths (and the badge width) stay available no matter what is
          currently visible. */}
      <Flex
        ref={measureRef}
        aria-hidden
        position="absolute"
        top={0}
        left={0}
        height={0}
        overflow="hidden"
        visibility="hidden"
        pointerEvents="none"
        wrap="wrap"
        gap="xs"
      >
        {toolNames.map((name, index) => (
          <Tag key={`${name}-${index}`} variant="muted" data-tool-tag>
            {name}
          </Tag>
        ))}
        <Tag variant="muted" data-tool-badge>
          {`+${toolNames.length}`}
        </Tag>
      </Flex>
    </ToolsContainer>
  );
}

const TablePagination = styled(Pagination)`
  margin: 0;
`;

const FixedRowHeightGrid = styled('div')`
  /* Pin data rows to a fixed height by sizing their body cells. Head cells are
     <th> (unaffected), and the empty/loading/error status cell keeps its own
     size because its larger min-height wins over this fixed height. */
  tbody td {
    height: ${ROW_HEIGHT}px;
  }
`;

// Separator is full-height by default; pin it to a short fixed height so it
// reads as a small inline divider between the id and the user. Override its
// `align-self: stretch` so the fixed height stays centered in the row instead
// of pinning to the top.
// Keep the user icon from shrinking when the display name is long.
const UserIcon = styled(IconUser)`
  flex-shrink: 0;
`;

const CellDivider = styled(Separator)`
  align-self: center;
  height: 12px;
  flex-shrink: 0;
`;

// align-content isn't a Flex prop, so keep it as a small styled(Flex) so wrapped
// tag rows stack from the top instead of spreading across the container height.
const ToolsContainer = styled(Flex)`
  align-content: flex-start;
`;
