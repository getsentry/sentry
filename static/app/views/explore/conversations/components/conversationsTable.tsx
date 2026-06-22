import {Fragment, memo, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {parseAsString, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Count} from 'sentry/components/count';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  GridEditable,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import {useStateBasedColumnResize} from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import {TimeSince} from 'sentry/components/timeSince';
import {IconArrow, IconEdit, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isUUID} from 'sentry/utils/string/isUUID';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ToolTags} from 'sentry/views/explore/conversations/components/toolTags';
import {USER_FILTER_PARAM} from 'sentry/views/explore/conversations/components/userFilterSelector';
import {useConversationAgents} from 'sentry/views/explore/conversations/hooks/useConversationAgents';
import {
  useConversations,
  type Conversation,
  type ConversationUser,
} from 'sentry/views/explore/conversations/hooks/useConversations';
import {
  useConversationToolStats,
  type ToolStat,
} from 'sentry/views/explore/conversations/hooks/useConversationToolStats';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';
import {hasGenAiConversationsFeature} from 'sentry/views/explore/conversations/utils/features';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';

const ONE_HOUR_MS = 60 * 60 * 1000;
const VISIBLE_PAGE_SIZE = 25;

function buildLocalPageLinks({
  hasPrev,
  hasNext,
}: {
  hasNext: boolean;
  hasPrev: boolean;
}): string {
  const prev = `<http://localhost/api/0/prev>; rel="previous"; results="${hasPrev}"; cursor="0:0:1"`;
  const next = `<http://localhost/api/0/next>; rel="next"; results="${hasNext}"; cursor="0:0:0"`;
  return `${prev}, ${next}`;
}

function getConversationDetailUrl(
  orgSlug: string,
  conversation: Conversation,
  projects: number[]
): string {
  const basePath = `/organizations/${orgSlug}/explore/${CONVERSATIONS_LANDING_SUB_PATH}/${encodeURIComponent(conversation.conversationId)}/`;
  const params = new URLSearchParams();
  if (conversation.startTimestamp) {
    params.set(
      'start',
      new Date(conversation.startTimestamp - ONE_HOUR_MS).toISOString()
    );
  }
  if (conversation.endTimestamp) {
    params.set('end', new Date(conversation.endTimestamp + ONE_HOUR_MS).toISOString());
  }
  for (const project of projects) {
    params.append('project', String(project));
  }
  const qs = params.toString();
  return normalizeUrl(qs ? `${basePath}?${qs}` : basePath);
}

export function ConversationsTable() {
  const organization = useOrganization();
  const showTable = hasGenAiConversationsFeature(organization);

  if (!showTable) {
    return null;
  }
  return <ConversationsTableInner />;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'conversationId', name: t('Conv. ID'), width: 120},
  {key: 'user', name: t('User'), width: 160},
  {key: 'agent', name: t('Agent'), width: 180},
  {key: 'toolsUsed', name: t('Tools'), width: 280},
  {key: 'messagesErrors', name: t('Messages / Errors'), width: 170},
  {key: 'tokensAndCost', name: t('Total Tokens / Cost'), width: 190},
  {key: 'timestamp', name: t('Last Message'), width: 140},
];

const rightAlignColumns = new Set(['messagesErrors', 'tokensAndCost', 'timestamp']);

type SortState = {
  direction: 'asc' | 'desc';
  key: string;
};

const SORTABLE_COLUMNS = new Set(['messagesErrors', 'tokensAndCost', 'timestamp']);

const SORT_ACCESSORS: Record<string, (c: Conversation) => number> = {
  messagesErrors: c => c.llmCalls,
  tokensAndCost: c => c.totalTokens,
  timestamp: c => c.endTimestamp,
};

const DEFAULT_SORT: SortState = {key: 'timestamp', direction: 'desc'};

const REQUIRED_COLUMN = 'conversationId';
const DEFAULT_VISIBLE_KEYS = defaultColumnOrder.map(c => c.key);

function ColumnEditorModal({
  Header,
  Body,
  Footer,
  closeModal,
  visibleKeys,
  onApply,
}: ModalRenderProps & {
  onApply: (keys: string[]) => void;
  visibleKeys: string[];
}) {
  const [tempKeys, setTempKeys] = useState<string[]>(visibleKeys);

  const toggleColumn = (key: string) => {
    setTempKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Edit Table')}</h4>
      </Header>
      <Body>
        <Stack gap="md">
          {defaultColumnOrder.map(col => (
            <Flex key={col.key} align="center" gap="xs" as="label">
              <Checkbox
                checked={tempKeys.includes(col.key)}
                disabled={col.key === REQUIRED_COLUMN}
                onChange={() => toggleColumn(col.key)}
              />
              <Text>{col.name}</Text>
            </Flex>
          ))}
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button size="sm" onClick={closeModal}>
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              onApply(tempKeys);
              closeModal();
            }}
          >
            {t('Apply')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

function useColumnVisibility() {
  const organization = useOrganization();
  return useLocalStorageState<string[]>(
    `conversations-table-columns:${organization.slug}`,
    DEFAULT_VISIBLE_KEYS
  );
}

export function EditTableButton() {
  const {openModal} = useModal();
  const [visibleColumnKeys, setVisibleColumnKeys] = useColumnVisibility();

  const openColumnEditor = () => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          visibleKeys={visibleColumnKeys}
          onApply={setVisibleColumnKeys}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  };

  return (
    <Button size="sm" icon={<IconEdit />} onClick={openColumnEditor}>
      {t('Edit Table')}
    </Button>
  );
}

function ConversationsTableInner() {
  const organization = useOrganization();
  const [visibleColumnKeys] = useColumnVisibility();

  const activeColumns = useMemo(
    () => defaultColumnOrder.filter(col => visibleColumnKeys.includes(col.key)),
    [visibleColumnKeys]
  );

  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns: activeColumns,
  });

  const {data, isLoading, error, pageLinks, setCursor} = useConversations();
  const {agentsByConversation} = useConversationAgents();
  const {toolStatsByConversation} = useConversationToolStats();
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [localPage, setLocalPage] = useState(0);
  const [userFilter] = useQueryState(USER_FILTER_PARAM, parseAsString.withDefault(''));

  const filteredData = useMemo(() => {
    if (userFilter === 'has_user') {
      return data.filter(
        c => c.user !== null && (c.user.email || c.user.username || c.user.ip_address)
      );
    }
    if (userFilter === 'no_user') {
      return data.filter(
        c => c.user === null || !(c.user.email || c.user.username || c.user.ip_address)
      );
    }
    return data;
  }, [data, userFilter]);

  useEffect(() => {
    setLocalPage(0);
  }, [userFilter, data]);

  const sortedData = useMemo(() => {
    const accessor = SORT_ACCESSORS[sort.key];
    if (!accessor) {
      return filteredData;
    }
    return [...filteredData].sort((a, b) => {
      const diff = accessor(a) - accessor(b);
      return sort.direction === 'asc' ? diff : -diff;
    });
  }, [filteredData, sort]);

  const totalLocalPages = Math.ceil(sortedData.length / VISIBLE_PAGE_SIZE);
  const clampedPage = Math.min(localPage, Math.max(0, totalLocalPages - 1));
  const pageData = useMemo(
    () =>
      sortedData.slice(
        clampedPage * VISIBLE_PAGE_SIZE,
        (clampedPage + 1) * VISIBLE_PAGE_SIZE
      ),
    [sortedData, clampedPage]
  );

  const hasNextServerPage = pageLinks?.includes('rel="next"; results="true"') ?? false;
  const hasPrevServerPage =
    pageLinks?.includes('rel="previous"; results="true"') ?? false;
  const isLastLocalPage = clampedPage >= totalLocalPages - 1;
  const isFirstLocalPage = clampedPage <= 0;

  const handlePaginate: typeof setCursor = (_cursor, path, query, pageDelta) => {
    if (pageDelta > 0) {
      if (!isLastLocalPage) {
        setLocalPage(prev => prev + 1);
      } else if (hasNextServerPage) {
        setLocalPage(0);
        trackAnalytics('conversations.table.paginate', {
          organization,
          direction: 'next',
        });
        setCursor(_cursor, path, query, pageDelta);
      }
    } else {
      if (!isFirstLocalPage) {
        setLocalPage(prev => prev - 1);
      } else if (hasPrevServerPage) {
        setLocalPage(0);
        trackAnalytics('conversations.table.paginate', {
          organization,
          direction: 'previous',
        });
        setCursor(_cursor, path, query, pageDelta);
      }
    }
  };

  const localPageLinks = buildLocalPageLinks({
    hasPrev: !isFirstLocalPage || hasPrevServerPage,
    hasNext: !isLastLocalPage || hasNextServerPage,
  });

  const handleSort = useCallback((columnKey: string) => {
    setSort(prev => {
      if (prev.key === columnKey) {
        return {key: columnKey, direction: prev.direction === 'asc' ? 'desc' : 'asc'};
      }
      return {key: columnKey, direction: 'desc'};
    });
  }, []);

  const renderHeadCell = useCallback(
    (column: GridColumnHeader<string>) => {
      const isSortable = SORTABLE_COLUMNS.has(column.key);
      const isActive = sort.key === column.key;

      return (
        <SortableHeader
          onClick={isSortable ? () => handleSort(column.key) : undefined}
          isSortable={isSortable}
          role={isSortable ? 'button' : undefined}
        >
          <Flex
            flex="1"
            align="center"
            gap="xs"
            justify={rightAlignColumns.has(column.key) ? 'end' : 'start'}
          >
            {column.key === 'messagesErrors' ? (
              <Tooltip title={t('LLM calls / Errors')}>
                <DashedUnderline>{column.name}</DashedUnderline>
              </Tooltip>
            ) : (
              column.name
            )}
            {isActive && (
              <IconArrow direction={sort.direction === 'asc' ? 'up' : 'down'} size="xs" />
            )}
          </Flex>
        </SortableHeader>
      );
    },
    [sort, handleSort]
  );

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: Conversation) => {
      return (
        <BodyCell
          column={column}
          dataRow={dataRow}
          agentNames={agentsByConversation[dataRow.conversationId]}
          toolStats={toolStatsByConversation[dataRow.conversationId]}
        />
      );
    },
    [agentsByConversation, toolStatsByConversation]
  );

  return (
    <Fragment>
      <Container>
        <GridEditable
          isLoading={isLoading}
          error={error}
          data={pageData}
          columnOrder={columnOrder}
          columnSortBy={EMPTY_ARRAY}
          stickyHeader
          grid={{
            renderBodyCell,
            renderHeadCell,
            onResizeColumn: handleResizeColumn,
          }}
        />
      </Container>
      <Pagination pageLinks={localPageLinks} onCursor={handlePaginate} />
    </Fragment>
  );
}

function isBlank(value: string | null): boolean {
  return !value || value === 'None';
}

function getUserDisplayName(user: ConversationUser): string {
  if (!isBlank(user.email)) return user.email!;
  if (!isBlank(user.username)) return user.username!;
  if (!isBlank(user.ip_address)) return user.ip_address!;
  return '—';
}

function UserNotInstrumentedTooltip() {
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

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
  agentNames,
  toolStats,
}: {
  agentNames: string[] | undefined;
  column: GridColumnHeader<string>;
  dataRow: Conversation;
  toolStats: ToolStat[] | undefined;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const detailUrl = getConversationDetailUrl(
    organization.slug,
    dataRow,
    selection.projects
  );

  switch (column.key) {
    case 'conversationId':
      return (
        <ConversationIdLink
          to={detailUrl}
          onClick={() =>
            trackAnalytics('conversations.table.open', {
              organization,
              source: 'table_conversation_id',
            })
          }
        >
          {isUUID(dataRow.conversationId) ? (
            dataRow.conversationId.slice(0, 8)
          ) : (
            <Tooltip title={dataRow.conversationId} showOnlyOnOverflow skipWrapper>
              <ConversationIdText ellipsis>{dataRow.conversationId}</ConversationIdText>
            </Tooltip>
          )}
        </ConversationIdLink>
      );
    case 'user': {
      if (!dataRow.user) {
        return (
          <InfoText variant="muted" title={<UserNotInstrumentedTooltip />}>
            &mdash;
          </InfoText>
        );
      }
      const displayName = getUserDisplayName(dataRow.user);
      const hasIdentity =
        !isBlank(dataRow.user.email) ||
        !isBlank(dataRow.user.username) ||
        !isBlank(dataRow.user.ip_address);
      return (
        <Tooltip title={displayName} showOnlyOnOverflow>
          <Flex align="center" gap="xs" minWidth={0}>
            {hasIdentity && <IconUser size="md" variant="muted" />}
            <Text ellipsis variant={hasIdentity ? undefined : 'muted'}>
              {displayName}
            </Text>
          </Flex>
        </Tooltip>
      );
    }
    case 'agent': {
      const names = agentNames?.length ? agentNames : dataRow.flow;
      const agentName = names?.[0] ?? null;
      if (!agentName) {
        return <Text variant="muted">&mdash;</Text>;
      }
      return (
        <Tooltip title={agentName} showOnlyOnOverflow skipWrapper>
          <Text ellipsis>{agentName}</Text>
        </Tooltip>
      );
    }
    case 'messagesErrors': {
      const hasErrors = dataRow.errors > 0;
      return (
        <Text as="div" align="right">
          <Count value={dataRow.llmCalls} />
          {'/'}
          {hasErrors ? (
            <ErrorCount>
              <Count value={dataRow.errors} />
            </ErrorCount>
          ) : (
            <Count value={dataRow.errors} />
          )}
        </Text>
      );
    }
    case 'toolsUsed':
      if (dataRow.toolNames.length === 0) {
        return <Text variant="muted">&mdash;</Text>;
      }
      return <ToolTags toolNames={dataRow.toolNames} toolStats={toolStats} />;
    case 'tokensAndCost':
      return (
        <Text as="div" align="right">
          <Count value={dataRow.totalTokens} /> /{' '}
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

const ConversationIdLink = styled(Link)`
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
  font-weight: normal;
`;

const ConversationIdText = styled(Text)`
  display: block;
  max-width: 100%;
  color: inherit;
`;

const ErrorCount = styled('span')`
  color: ${p => p.theme.tokens.content.danger};
`;

const SortableHeader = styled('div')<{isSortable: boolean}>`
  cursor: ${p => (p.isSortable ? 'pointer' : 'default')};
  user-select: none;
  width: 100%;
`;

const DashedUnderline = styled('span')`
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  cursor: pointer;
`;
