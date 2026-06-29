import {Fragment, memo, useCallback, useMemo, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Count} from 'sentry/components/count';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  GridEditable,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconEdit, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConversationMissingMessagesAlert} from 'sentry/views/explore/conversations/components/conversationMissingMessagesAlert';
import {
  getConversationDetailUrl,
  getUserDisplayName,
  InputOutputTooltipCell,
  UserNotInstrumentedTooltip,
} from 'sentry/views/explore/conversations/components/conversationsTable';
import {ConversationsTableEditModal} from 'sentry/views/explore/conversations/components/conversationsTableEditModal';
import {
  useConversations,
  type Conversation,
} from 'sentry/views/explore/conversations/hooks/useConversations';
import {useConversationsTableColumns} from 'sentry/views/explore/conversations/hooks/useConversationsTableColumns';
import {
  type ConversationColumnKey,
  CONVERSATION_COLUMNS,
  RIGHT_ALIGNED_CONVERSATION_COLUMNS,
} from 'sentry/views/explore/conversations/utils/tableColumns';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';

export function ConversationsTableNew() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const {openModal} = useModal();
  const {columns: columnKeys, setColumns} = useConversationsTableColumns();
  const {data, isLoading, error, pageLinks, setCursor} = useConversations();
  const [highlightedRowKey, setHighlightedRowKey] = useState<number | undefined>();

  // Session-only resized widths, keyed by column so they stick to the column
  // through add/remove/reorder (not persisted; reset on refresh).
  const [columnWidths, setColumnWidths] = useState<
    Partial<Record<ConversationColumnKey, number>>
  >({});

  const columnOrder = useMemo<Array<GridColumnOrder<ConversationColumnKey>>>(
    () =>
      columnKeys.map(key => ({
        key,
        name: CONVERSATION_COLUMNS[key].name,
        width: columnWidths[key] ?? CONVERSATION_COLUMNS[key].width,
      })),
    [columnKeys, columnWidths]
  );

  const handleResizeColumn = useCallback(
    (_columnIndex: number, nextColumn: GridColumnOrder<ConversationColumnKey>) => {
      setColumnWidths(prev => ({...prev, [nextColumn.key]: nextColumn.width}));
    },
    []
  );

  const showMissingMessagesAlert =
    !isLoading &&
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
          columns={columnKeys}
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
          {/* Raise the user column's growth-limit so it absorbs the leftover
              width instead of the last column stretching. The panel's
              horizontal scroll (and the `minWidth: 0` wrapper) keeps this from
              overflowing when there are too many columns to fit. */}
          {column.key === 'user' && <Container width="100vw" />}
        </Flex>
      );
    },
    []
  );

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<ConversationColumnKey>, dataRow: Conversation) => (
      <BodyCell
        column={column}
        dataRow={dataRow}
        organization={organization}
        projects={selection.projects}
      />
    ),
    [organization, selection.projects]
  );

  const handleRowClick = useCallback(
    (dataRow: Conversation) => {
      trackAnalytics('conversations.table.open', {
        organization,
        source: 'table_row',
      });
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
        isLoading={isLoading}
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

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
  organization,
  projects,
}: {
  column: GridColumnOrder<ConversationColumnKey>;
  dataRow: Conversation;
  organization: Organization;
  projects: number[];
}) {
  switch (column.key) {
    case 'conversationId': {
      const detailUrl = getConversationDetailUrl(organization.slug, dataRow, projects);
      return (
        <Link
          to={detailUrl}
          onClick={event => {
            // Let the link handle navigation; don't also trigger the row click.
            event.stopPropagation();
            trackAnalytics('conversations.table.open', {
              organization,
              source: 'table_conversation_id',
            });
          }}
        >
          {isUUID(dataRow.conversationId) ? (
            dataRow.conversationId.slice(0, 8)
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
              skipWrapper
            >
              <Text as="div" ellipsis variant="inherit">
                {dataRow.conversationId}
              </Text>
            </Tooltip>
          )}
        </Link>
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
            <Tooltip title={displayName} showOnlyOnOverflow skipWrapper>
              <Text ellipsis>{displayName}</Text>
            </Tooltip>
          ) : (
            <Text>&mdash;</Text>
          )}
        </Flex>
      );
    }
    case 'toolCalls':
      return (
        <Text as="div">
          <Count value={dataRow.toolCalls} />
        </Text>
      );
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
          <TimeSince unitStyle="extraShort" date={new Date(dataRow.endTimestamp)} />
        </Text>
      );
    case 'input':
      return dataRow.firstInput ? (
        <InputOutputTooltipCell text={dataRow.firstInput} />
      ) : (
        <Text>&mdash;</Text>
      );
    case 'output':
      return dataRow.lastOutput ? (
        <InputOutputTooltipCell text={dataRow.lastOutput} />
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
