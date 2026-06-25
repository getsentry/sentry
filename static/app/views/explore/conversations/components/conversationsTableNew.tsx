import {Fragment, memo, useCallback, useState} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
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
import {useStateBasedColumnResize} from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import {TimeSince} from 'sentry/components/timeSince';
import {IconUser} from 'sentry/icons';
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
  UserNotInstrumentedTooltip,
} from 'sentry/views/explore/conversations/components/conversationsTable';
import {
  useConversations,
  type Conversation,
} from 'sentry/views/explore/conversations/hooks/useConversations';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';

type ColumnKey =
  | 'conversationId'
  | 'llmCalls'
  | 'user'
  | 'toolCalls'
  | 'errors'
  | 'cost'
  | 'timestamp';

const DEFAULT_COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: 'conversationId', name: t('Conv. ID'), width: 150},
  {key: 'llmCalls', name: t('LLM Calls'), width: 100},
  {key: 'user', name: t('User'), width: COL_WIDTH_UNDEFINED},
  {key: 'toolCalls', name: t('Tool Calls'), width: 120},
  {key: 'errors', name: t('Errors'), width: 100},
  {key: 'cost', name: t('Cost'), width: 110},
  {key: 'timestamp', name: t('Last Message'), width: 140},
];

const RIGHT_ALIGN_COLUMNS = new Set<ColumnKey>(['timestamp']);

export function ConversationsTableNew() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const {columns, handleResizeColumn} = useStateBasedColumnResize({
    columns: DEFAULT_COLUMNS,
  });
  const {data, isLoading, error, pageLinks, setCursor} = useConversations();
  const [highlightedRowKey, setHighlightedRowKey] = useState<number | undefined>();

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

  const renderHeadCell = useCallback((column: GridColumnHeader<ColumnKey>) => {
    return (
      <Flex
        flex="1"
        align="center"
        gap="xs"
        justify={RIGHT_ALIGN_COLUMNS.has(column.key) ? 'end' : 'start'}
      >
        {column.name}
        {/* Force the flexible column to claim the leftover width so the others
            stay at their defined widths instead of the last column growing. */}
        {column.key === 'user' && <Container width="100vw" />}
      </Flex>
    );
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<ColumnKey>, dataRow: Conversation) => (
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
      <GridEditable
        isLoading={isLoading}
        error={error}
        data={data}
        columnOrder={columns}
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
  column: GridColumnOrder<ColumnKey>;
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
    default:
      return null;
  }
});
