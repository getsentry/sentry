import {Fragment, memo, useCallback, type ComponentPropsWithRef} from 'react';
import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Pagination} from '@sentry/scraps/pagination';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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
import {IconArrow, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {isUUID} from 'sentry/utils/string/isUUID';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConversationMissingMessagesAlert} from 'sentry/views/explore/conversations/components/conversationMissingMessagesAlert';
import {ToolTags} from 'sentry/views/explore/conversations/components/toolTags';
import {
  useConversations,
  type Conversation,
  type ConversationUser,
} from 'sentry/views/explore/conversations/hooks/useConversations';
import {CONVERSATIONS_LANDING_SUB_PATH} from 'sentry/views/explore/conversations/settings';
import {hasGenAiConversationsFeature} from 'sentry/views/explore/conversations/utils/features';
import {getConversationsListLocationState} from 'sentry/views/explore/conversations/utils/listNavigation';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {NegativeCostInfo} from 'sentry/views/insights/pages/agents/components/negativeCostWarning';
import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function getConversationDetailUrl(
  orgSlug: string,
  conversation: Conversation,
  projects: number[],
  referrer = 'conversations-table'
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
  params.set('referrer', referrer);
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
  {key: 'conversationId', name: t('Conv. ID'), width: 0},
  {key: 'inputOutput', name: t('First Input / Last Output'), width: COL_WIDTH_UNDEFINED},
  {key: 'user', name: t('User'), width: 120},
  {key: 'steps', name: t('Steps'), width: 80},
  {key: 'toolsUsed', name: t('Tools'), width: 140},
  {key: 'tokensAndCost', name: t('Total Tokens / Cost'), width: 170},
  {key: 'timestamp', name: t('Last Message'), width: 120},
];

const rightAlignColumns = new Set(['steps', 'tokensAndCost', 'timestamp']);

function ConversationsTableInner() {
  const organization = useOrganization();
  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns: defaultColumnOrder,
  });

  const {data, isFetching, error, pageLinks, setCursor} = useConversations();

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

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <Flex
        flex="1"
        align="center"
        gap="xs"
        justify={rightAlignColumns.has(column.key) ? 'end' : 'start'}
      >
        {column.key === 'steps' ? (
          <Tooltip title={t('LLM calls + Tool calls')}>
            <DashedUnderline>{column.name}</DashedUnderline>
          </Tooltip>
        ) : (
          column.name
        )}
        {column.key === 'timestamp' && <IconArrow direction="down" size="xs" />}
        {column.key === 'inputOutput' && (
          // Force the cell to take as much width as possible in the table
          // layout, otherwise GridEditable will let the last column grow.
          <Container width="100vw" />
        )}
      </Flex>
    );
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: Conversation) => {
      return <BodyCell column={column} dataRow={dataRow} />;
    },
    []
  );

  return (
    <Fragment>
      {showMissingMessagesAlert && <ConversationMissingMessagesAlert />}
      <Container>
        <GridEditable
          isLoading={isFetching}
          error={error}
          data={data}
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
      <Pagination pageLinks={pageLinks} onCursor={handlePaginate} />
    </Fragment>
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

const TOOLTIP_MAX_CHARS = 2048;
const CELL_MAX_CHARS = 256;

function TooltipContent({text}: {text: string}) {
  return (
    <TooltipTextContainer onClick={e => e.stopPropagation()}>
      <AIContentRenderer text={ellipsize(text, TOOLTIP_MAX_CHARS)} inline />
    </TooltipTextContainer>
  );
}

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

export function CellContent({text, ref, ...props}: CellContentProps) {
  const cleanedText = cleanMarkdownForCell(text);
  return (
    <SingleLineMarkdown ref={ref} {...props}>
      <MarkedText text={ellipsize(cleanedText, CELL_MAX_CHARS)} />
    </SingleLineMarkdown>
  );
}

export function InputOutputTooltipCell({text}: {text: string}) {
  return (
    <Tooltip
      title={<TooltipContent text={text} />}
      showOnlyOnOverflow
      maxWidth={800}
      isHoverable
      skipWrapper
      position="right"
    >
      <CellContent text={text} />
    </Tooltip>
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

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
}: {
  column: GridColumnHeader<string>;
  dataRow: Conversation;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {selection} = usePageFilters();

  const detailUrl = getConversationDetailUrl(
    organization.slug,
    dataRow,
    selection.projects
  );
  const listLocationState = getConversationsListLocationState(location.query);

  const navigateToDetail = () => {
    navigate(detailUrl, {state: listLocationState});
  };

  switch (column.key) {
    case 'conversationId':
      return (
        <ConversationIdLink to={detailUrl} state={listLocationState}>
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
      const displayName = getUserDisplayName(dataRow.user) ?? t('Unknown');
      return (
        <Tooltip title={displayName} showOnlyOnOverflow>
          <Flex align="center" gap="xs" minWidth={0}>
            <IconUser size="md" variant="muted" />
            <Text ellipsis>{displayName}</Text>
          </Flex>
        </Tooltip>
      );
    }
    case 'inputOutput': {
      return (
        <Stack width="100%">
          <InputOutputRow type="button" onClick={() => navigateToDetail()}>
            <InputOutputLabel variant="muted">{t('Input')}</InputOutputLabel>
            <Flex flex="1" minWidth="0">
              {dataRow.firstInput ? (
                <InputOutputTooltipCell text={dataRow.firstInput} />
              ) : (
                <Text variant="muted">&mdash;</Text>
              )}
            </Flex>
          </InputOutputRow>
          <InputOutputRow type="button" onClick={() => navigateToDetail()}>
            <InputOutputLabel variant="muted">{t('Output')}</InputOutputLabel>
            <Flex flex="1" minWidth="0">
              {dataRow.lastOutput ? (
                <InputOutputTooltipCell text={dataRow.lastOutput} />
              ) : (
                <Text variant="muted">&mdash;</Text>
              )}
            </Flex>
          </InputOutputRow>
        </Stack>
      );
    }
    case 'steps':
      return (
        <Text as="div" align="right">
          <Count value={dataRow.llmCalls + dataRow.toolCalls} />
        </Text>
      );
    case 'toolsUsed':
      if (dataRow.toolNames.length === 0) {
        return <Text variant="muted">&mdash;</Text>;
      }
      return <ToolTags toolNames={dataRow.toolNames} />;
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
          <TimeSince unitStyle="extraShort" date={dataRow.endTimestamp} />
        </Text>
      );
    default:
      return null;
  }
});

const TooltipTextContainer = styled('div')`
  text-align: left;
  max-width: min(800px, 60vw);
  max-height: 50vh;
  overflow: hidden;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-size: inherit;
    font-weight: bold;
    margin: 0;
  }
`;

const SingleLineMarkdown = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  * {
    display: inline;
  }
`;

const ConversationIdLink = styled(Link)`
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
  font-weight: normal;
`;

const ConversationIdText = styled(Text)`
  display: block;
  max-width: 100%;
  color: inherit;
`;

const InputOutputRow = styled('button')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  width: 100%;

  &:hover {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background-color: ${p =>
      p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const InputOutputLabel = styled(Text)`
  width: 4em;
`;

const DashedUnderline = styled('span')`
  text-decoration: underline dotted;
  text-underline-offset: 2px;
  cursor: pointer;
`;
