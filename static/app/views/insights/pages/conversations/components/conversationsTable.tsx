import {Fragment, memo, useCallback, type ComponentPropsWithRef} from 'react';
import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import Count from 'sentry/components/count';
import useDrawer from 'sentry/components/globalDrawer';
import Pagination from 'sentry/components/pagination';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import useOrganization from 'sentry/utils/useOrganization';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {hasGenAiConversationsFeature} from 'sentry/views/insights/pages/agents/utils/features';
import type {useConversationViewDrawer} from 'sentry/views/insights/pages/conversations/components/conversationDrawer';
import {ToolTags} from 'sentry/views/insights/pages/conversations/components/toolTags';
import {
  useConversations,
  type Conversation,
  type ConversationUser,
} from 'sentry/views/insights/pages/conversations/hooks/useConversations';

interface ConversationsTableProps {
  openConversationViewDrawer: ReturnType<
    typeof useConversationViewDrawer
  >['openConversationViewDrawer'];
}

export function ConversationsTable({
  openConversationViewDrawer,
}: ConversationsTableProps) {
  const organization = useOrganization();
  const showTable = hasGenAiConversationsFeature(organization);

  if (!showTable) {
    return null;
  }
  return (
    <ConversationsTableInner openConversationViewDrawer={openConversationViewDrawer} />
  );
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'conversationId', name: t('Conv. ID'), width: 0},
  {key: 'inputOutput', name: t('First Input / Last Output'), width: COL_WIDTH_UNDEFINED},
  {key: 'user', name: t('User'), width: 120},
  {key: 'steps', name: t('Steps'), width: 80},
  {key: 'toolsUsed', name: t('Tools Used'), width: 200},
  {key: 'tokensAndCost', name: t('Total Tokens / Cost'), width: 170},
  {key: 'timestamp', name: t('Last Message'), width: 120},
];

const rightAlignColumns = new Set(['steps', 'tokensAndCost', 'timestamp']);

function ConversationsTableInner({openConversationViewDrawer}: ConversationsTableProps) {
  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns: defaultColumnOrder,
  });

  const {data, isLoading, error, pageLinks, setCursor} = useConversations();

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <Flex
        flex="1"
        align="center"
        gap="xs"
        justify={rightAlignColumns.has(column.key) ? 'end' : 'start'}
      >
        {column.key === 'user' && <IconUser size="xs" />}
        {column.key === 'steps' ? (
          <Tooltip title={t('LLM calls + Tool calls')}>
            <DashedUnderline>{column.name}</DashedUnderline>
          </Tooltip>
        ) : (
          column.name
        )}
        {column.key === 'timestamp' && <IconArrow direction="down" size="xs" />}
        {column.key === 'inputOutput' && <CellExpander />}
      </Flex>
    );
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: Conversation) => {
      return (
        <BodyCell
          column={column}
          dataRow={dataRow}
          openConversationViewDrawer={openConversationViewDrawer}
        />
      );
    },
    [openConversationViewDrawer]
  );

  return (
    <Fragment>
      <Container>
        <GridEditable
          isLoading={isLoading}
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
      <Pagination pageLinks={pageLinks} onCursor={setCursor} />
    </Fragment>
  );
}

function getUserDisplayName(user: ConversationUser): string {
  return user.email || user.username || user.ip_address || t('Unknown');
}

const TOOLTIP_MAX_CHARS = 2048;
const CELL_MAX_CHARS = 256;

function TooltipContent({text}: {text: string}) {
  return (
    <TooltipTextContainer>
      <MarkedText text={ellipsize(text, TOOLTIP_MAX_CHARS)} />
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

function CellContent({text, ...props}: CellContentProps) {
  const cleanedText = cleanMarkdownForCell(text);
  return (
    <SingleLineMarkdown {...props}>
      <MarkedText text={ellipsize(cleanedText, CELL_MAX_CHARS)} />
    </SingleLineMarkdown>
  );
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
  openConversationViewDrawer,
}: {
  column: GridColumnHeader<string>;
  dataRow: Conversation;
  openConversationViewDrawer: ConversationsTableProps['openConversationViewDrawer'];
}) {
  const {isDrawerOpen} = useDrawer();

  switch (column.key) {
    case 'conversationId':
      return (
        <ConversationIdButton
          priority="link"
          onClick={() =>
            openConversationViewDrawer({
              conversation: dataRow,
              source: 'table_conversation_id',
            })
          }
        >
          {dataRow.conversationId.slice(0, 8)}
        </ConversationIdButton>
      );
    case 'user': {
      if (!dataRow.user) {
        return (
          <Tooltip title={<UserNotInstrumentedTooltip />} isHoverable>
            <Text variant="muted">&mdash;</Text>
          </Tooltip>
        );
      }
      const displayName = getUserDisplayName(dataRow.user);
      return (
        <Flex align="center" gap="sm">
          <UserAvatar
            user={{
              id: dataRow.user.id ?? '',
              name: displayName,
              email: dataRow.user.email ?? '',
              username: dataRow.user.username ?? '',
              ip_address: dataRow.user.ip_address ?? '',
            }}
            size={20}
          />
          <Tooltip title={displayName} showOnlyOnOverflow>
            <Text ellipsis>{displayName}</Text>
          </Tooltip>
        </Flex>
      );
    }
    case 'inputOutput': {
      return (
        <Stack width="100%">
          <InputOutputRow
            type="button"
            onClick={() =>
              openConversationViewDrawer({conversation: dataRow, source: 'table_input'})
            }
          >
            <InputOutputLabel variant="muted">{t('Input')}</InputOutputLabel>
            <Flex flex="1" minWidth="0">
              {dataRow.firstInput ? (
                <Tooltip
                  title={<TooltipContent text={dataRow.firstInput} />}
                  showOnlyOnOverflow
                  maxWidth={800}
                  isHoverable
                  delay={500}
                  skipWrapper
                  position="right"
                  disabled={isDrawerOpen}
                >
                  <CellContent text={dataRow.firstInput} />
                </Tooltip>
              ) : (
                <Text variant="muted">&mdash;</Text>
              )}
            </Flex>
          </InputOutputRow>
          <InputOutputRow
            type="button"
            onClick={() =>
              openConversationViewDrawer({conversation: dataRow, source: 'table_output'})
            }
          >
            <InputOutputLabel variant="muted">{t('Output')}</InputOutputLabel>
            <Flex flex="1" minWidth="0">
              {dataRow.lastOutput ? (
                <Tooltip
                  title={<TooltipContent text={dataRow.lastOutput} />}
                  showOnlyOnOverflow
                  maxWidth={800}
                  isHoverable
                  delay={500}
                  skipWrapper
                  position="right"
                  disabled={isDrawerOpen}
                >
                  <CellContent text={dataRow.lastOutput} />
                </Tooltip>
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
        <TextAlignRight>
          <Count value={dataRow.llmCalls + dataRow.toolCalls} />
        </TextAlignRight>
      );
    case 'toolsUsed':
      if (dataRow.toolNames.length === 0) {
        return <Text variant="muted">&mdash;</Text>;
      }
      return (
        <ToolTags
          toolNames={dataRow.toolNames}
          conversation={dataRow}
          openConversationViewDrawer={openConversationViewDrawer}
        />
      );
    case 'tokensAndCost':
      return (
        <TextAlignRight>
          <Count value={dataRow.totalTokens} /> / <LLMCosts cost={dataRow.totalCost} />
        </TextAlignRight>
      );
    case 'timestamp':
      return (
        <TextAlignRight>
          <TimeSince unitStyle="extraShort" date={new Date(dataRow.endTimestamp)} />
        </TextAlignRight>
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

/**
 * Used to force the cell to expand take as much width as possible in the table layout
 * otherwise grid editable will let the last column grow
 */
const CellExpander = styled('div')`
  width: 100vw;
`;

const ConversationIdButton = styled(Button)`
  font-weight: normal;
  padding: 0;
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
