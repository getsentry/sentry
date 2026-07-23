import {
  Fragment,
  memo,
  useCallback,
  useMemo,
  useState,
  type ComponentPropsWithRef,
} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Count} from 'sentry/components/count';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconEdit, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {isUUID} from 'sentry/utils/string/isUUID';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConversationMissingMessagesAlert} from 'sentry/views/explore/conversations/components/conversationMissingMessagesAlert';
import {ConversationsTableEditModal} from 'sentry/views/explore/conversations/components/conversationsTableEditModal';
import {ConversationToolCallsBreakdown} from 'sentry/views/explore/conversations/components/conversationToolCallsBreakdown';
import {useConversationDirectHitRedirect} from 'sentry/views/explore/conversations/hooks/useConversationDirectHitRedirect';
import {
  useConversations,
  type Conversation,
  type ConversationUser,
} from 'sentry/views/explore/conversations/hooks/useConversations';
import {useConversationsTableColumns} from 'sentry/views/explore/conversations/hooks/useConversationsTableColumns';
import {useConversationToolBreakdown} from 'sentry/views/explore/conversations/hooks/useConversationToolBreakdown';
import {
  type ConversationColumnKey,
  CONVERSATION_COLUMNS,
  RIGHT_ALIGNED_CONVERSATION_COLUMNS,
} from 'sentry/views/explore/conversations/utils/tableColumns';
import {getConversationDetailUrl} from 'sentry/views/explore/conversations/utils/urlParams';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';

export function ConversationsTable() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const {openModal} = useModal();
  const {columns, setColumns} = useConversationsTableColumns();
  const {data, isFetching, error, pageLinks, setCursor, isDirectHit} = useConversations();
  useConversationDirectHitRedirect({isDirectHit, conversations: data});
  const [highlightedRowKey, setHighlightedRowKey] = useState<number | undefined>();

  const columnOrder = useMemo<Array<GridColumnOrder<ConversationColumnKey>>>(
    () =>
      columns.map(({key, width}) => ({
        key,
        name: CONVERSATION_COLUMNS[key].name,
        width: width ?? CONVERSATION_COLUMNS[key].width,
      })),
    [columns]
  );

  const handleResizeColumn = useCallback(
    (columnIndex: number, nextColumn: GridColumnOrder<ConversationColumnKey>) => {
      const {width} = nextColumn;
      // A double-click reset sends COL_WIDTH_UNDEFINED (-1); drop the persisted
      // width so the column falls back to its default instead of keeping the old
      // value. Any other non-positive width is ignored.
      setColumns(
        columns.map((c, i) => {
          if (i !== columnIndex) {
            return c;
          }
          if (typeof width === 'number' && width > 0) {
            return {...c, width: Math.round(width)};
          }
          if (width === COL_WIDTH_UNDEFINED) {
            return {key: c.key};
          }
          return c;
        })
      );
    },
    [columns, setColumns]
  );

  const showMissingMessagesAlert =
    !isFetching &&
    !error &&
    data.length > 0 &&
    data.every(conversation => !conversation.firstInput && !conversation.lastOutput);

  const handlePaginate: typeof setCursor = (cursor, path, query, pageDelta) => {
    trackAnalytics('conversations.table.paginate', {
      organization,
      direction: pageDelta > 0 ? 'next' : 'previous',
    });
    setCursor(cursor, path, query, pageDelta);
  };

  const openColumnEditor = () => {
    openModal(
      modalProps => (
        <ConversationsTableEditModal
          {...modalProps}
          columns={columns}
          onColumnsChange={setColumns}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  };

  const renderHeadCell = useCallback(
    (column: GridColumnHeader<ConversationColumnKey>) => {
      return (
        <Flex
          flex="1"
          align="center"
          gap="xs"
          justify={RIGHT_ALIGNED_CONVERSATION_COLUMNS.has(column.key) ? 'end' : 'start'}
        >
          {column.name}
          {/* Raise the input column's growth-limit so it absorbs the leftover
              width instead of the last column stretching. The panel's
              horizontal scroll (and the `minWidth: 0` wrapper) keeps this from
              overflowing when there are too many columns to fit. */}
          {column.key === 'input' && <Container width="100vw" />}
        </Flex>
      );
    },
    []
  );

  const renderBodyCell = useCallback(
    (
      column: GridColumnOrder<ConversationColumnKey>,
      dataRow: Conversation,
      rowIndex: number
    ) => (
      <BodyCell
        column={column}
        dataRow={dataRow}
        organization={organization}
        projects={selection.projects}
        isRowHovered={rowIndex === highlightedRowKey}
      />
    ),
    [organization, selection.projects, highlightedRowKey]
  );

  const handleRowClick = useCallback(
    (dataRow: Conversation) => {
      navigate(getConversationDetailUrl(organization.slug, dataRow, selection.projects));
    },
    [navigate, organization, selection.projects]
  );

  return (
    <Fragment>
      {showMissingMessagesAlert && <ConversationMissingMessagesAlert />}
      <Flex justify="end">
        <Button size="sm" icon={<IconEdit />} onClick={openColumnEditor}>
          {t('Edit Table')}
        </Button>
      </Flex>
      <GridEditable
        isLoading={isFetching}
        error={error}
        data={data}
        columnOrder={columnOrder}
        columnSortBy={[]}
        stickyHeader
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
      <Pagination pageLinks={pageLinks} onCursor={handlePaginate} />
    </Fragment>
  );
}

function ConversationLink(props: {
  children: React.ReactNode;
  dataRow: Conversation;
  organization: Organization;
  projects: number[];
}) {
  const detailUrl = getConversationDetailUrl(
    props.organization.slug,
    props.dataRow,
    props.projects
  );
  return (
    <Link
      to={detailUrl}
      onClick={event => {
        // Let the link handle navigation; don't also trigger the row click.
        event.stopPropagation();
      }}
    >
      <Text as="span" ellipsis variant="inherit">
        {props.children}
      </Text>
    </Link>
  );
}

const BodyCell = memo(function BodyCell({
  column,
  isRowHovered,
  dataRow,
  ...props
}: {
  column: GridColumnOrder<ConversationColumnKey>;
  dataRow: Conversation;
  isRowHovered: boolean;
  organization: Organization;
  projects: number[];
}) {
  switch (column.key) {
    case 'conversationId': {
      return isUUID(dataRow.conversationId) ? (
        <ConversationLink dataRow={dataRow} {...props}>
          {dataRow.conversationId.slice(0, 8)}
        </ConversationLink>
      ) : (
        <Tooltip
          title={
            <Flex align="center" gap="xs">
              <Text wordBreak="break-word">{dataRow.conversationId}</Text>
              <CopyToClipboardButton
                aria-label={t('Copy to clipboard')}
                variant="transparent"
                size="zero"
                text={dataRow.conversationId}
                onClick={event => event.stopPropagation()}
              />
            </Flex>
          }
          isHoverable
        >
          <ConversationLink dataRow={dataRow} {...props}>
            {dataRow.conversationId}
          </ConversationLink>
        </Tooltip>
      );
    }
    case 'llmCalls':
      return (
        <Text as="div">
          <Count value={dataRow.llmCalls} />
        </Text>
      );
    case 'user': {
      if (!dataRow.user) {
        return (
          <Tooltip title={<UserNotInstrumentedTooltip />} isHoverable skipWrapper>
            <Flex align="center" gap="xs" minWidth={0}>
              <IconUser size="md" />
              <Text>&mdash;</Text>
            </Flex>
          </Tooltip>
        );
      }
      const displayName = getUserDisplayName(dataRow.user);
      return (
        <Flex align="center" gap="xs" minWidth={0}>
          <IconUser size="md" />
          {displayName ? (
            <InfoText title={displayName} mode="overflowOnly">
              {displayName}
            </InfoText>
          ) : (
            <Text>&mdash;</Text>
          )}
        </Flex>
      );
    }
    case 'toolCalls':
      return <ToolCallsCell dataRow={dataRow} isRowHovered={isRowHovered} />;
    case 'errors':
      return (
        <Text as="div" variant={dataRow.errors > 0 ? 'danger' : undefined}>
          <Count value={dataRow.errors} />
        </Text>
      );
    case 'cost':
      return (
        <Text as="div">
          {dataRow.totalCost !== null && dataRow.totalCost < 0 ? (
            <NegativeCostInfo cost={dataRow.totalCost} />
          ) : (
            <LLMCosts cost={dataRow.totalCost} />
          )}
        </Text>
      );
    case 'timestamp':
      return (
        <Text as="div" align="right">
          <TimeSince unitStyle="extraShort" date={dataRow.endTimestamp} />
        </Text>
      );
    case 'input':
      return dataRow.firstInput ? (
        <CellContent text={dataRow.firstInput} />
      ) : (
        <Text>&mdash;</Text>
      );
    case 'output':
      return dataRow.lastOutput ? (
        <CellContent text={dataRow.lastOutput} />
      ) : (
        <Text>&mdash;</Text>
      );
    case 'inputTokens':
      return (
        <Text as="div">
          <Count value={dataRow.inputTokens} />
        </Text>
      );
    case 'outputTokens':
      return (
        <Text as="div">
          <Count value={dataRow.outputTokens} />
        </Text>
      );
    default:
      return null;
  }
});

function ToolCallsCell({
  dataRow,
  isRowHovered,
}: {
  dataRow: Conversation;
  isRowHovered: boolean;
}) {
  // Prefetch the breakdown on row hover so the card is already populated by the
  // time it opens. Shares the card's query key, so this only warms the cache —
  // it never fires a second request. The card fetches on its own when opened
  // (covers keyboard focus and hovering into the interactive card).
  useConversationToolBreakdown({
    conversationId: dataRow.conversationId,
    enabled: isRowHovered && dataRow.toolCalls > 0,
  });

  if (dataRow.toolCalls === 0) {
    return <Text as="div">{formatAbbreviatedNumber(dataRow.toolCalls)}</Text>;
  }

  // The number itself is the tooltip trigger, so the card stays anchored over
  // it (`position="top"`). To make the whole cell a hover target without moving
  // that anchor, the trigger carries a transparent `::before` that fills the
  // (relative) cell: pointer events over the pseudo-element dispatch to the
  // trigger, driving the tooltip's native hover — while popper measures only the
  // number's own box, so the anchor and the hoverable-card handoff are unchanged.
  return (
    <Flex flex="1" align="center" position="relative">
      <InfoText
        position="top"
        maxWidth={400}
        title={<ConversationToolCallsBreakdown conversationId={dataRow.conversationId} />}
        tabIndex={0}
        css={(theme: Theme) => css`
          text-decoration: underline dotted ${theme.tokens.content.secondary};
          text-decoration-thickness: 0.75px;
          text-underline-offset: 1.25px;
          outline: none;

          &::before {
            content: '';
            position: absolute;
            inset: 0;
          }

          &:focus-visible {
            ${theme.focusRing()}
          }
        `}
      >
        {formatAbbreviatedNumber(dataRow.toolCalls)}
      </InfoText>
    </Flex>
  );
}

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
    null
  );
}

const CELL_MAX_CHARS = 256;

function cleanMarkdownForCell(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '') // fenced code blocks
    .replace(/^#{1,6}\s+(.+)$/gm, '**$1**') // headings -> bold text
    .replace(/\s+/g, ' ')
    .trim();
}

type CellContentProps = ComponentPropsWithRef<'div'> & {
  text: string;
};

function CellContent({text, ref, ...props}: CellContentProps) {
  const cleanedText = cleanMarkdownForCell(text);
  return (
    <SingleLineMarkdown ref={ref} {...props}>
      <MarkedText text={ellipsize(cleanedText, CELL_MAX_CHARS)} />
    </SingleLineMarkdown>
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

const SingleLineMarkdown = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  * {
    display: inline;
  }
`;
