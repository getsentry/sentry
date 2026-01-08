import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import Count from 'sentry/components/count';
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
import useOrganization from 'sentry/utils/useOrganization';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {hasGenAiConversationsFeature} from 'sentry/views/insights/pages/agents/utils/features';
import {useConversationViewDrawer} from 'sentry/views/insights/pages/conversations/components/conversationDrawer';
import {
  useConversations,
  type Conversation,
  type ConversationUser,
} from 'sentry/views/insights/pages/conversations/hooks/useConversations';
import {DurationCell} from 'sentry/views/insights/pages/platform/shared/table/DurationCell';
import {NumberCell} from 'sentry/views/insights/pages/platform/shared/table/NumberCell';

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
  {key: 'conversationId', name: t('Conversation ID'), width: 140},
  {key: 'inputOutput', name: t('First Input / Last Output'), width: COL_WIDTH_UNDEFINED},
  {key: 'duration', name: t('Duration'), width: 130},
  {key: 'llmCalls', name: t('LLM Calls'), width: 110},
  {key: 'toolCalls', name: t('Tool Calls'), width: 110},
  {key: 'tokensAndCost', name: t('Total Tokens / Cost'), width: 170},
  {key: 'user', name: t('User'), width: 120},
  {key: 'timestamp', name: t('Last Message'), width: 120},
];

const rightAlignColumns = new Set([
  'llmCalls',
  'toolCalls',
  'tokensAndCost',
  'timestamp',
  'duration',
]);

function ConversationsTableInner() {
  const {columns: columnOrder, handleResizeColumn} = useStateBasedColumnResize({
    columns: defaultColumnOrder,
  });

  const {data, isLoading, error, pageLinks, setCursor} = useConversations();

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadCell align={rightAlignColumns.has(column.key) ? 'right' : 'left'}>
        {column.key === 'user' && <IconUser size="xs" />}
        {column.name}
        {column.key === 'timestamp' && <IconArrow direction="down" size="xs" />}
        {column.key === 'inputOutput' && <CellExpander />}
      </HeadCell>
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
      <GridEditableContainer>
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
      </GridEditableContainer>
      <Pagination pageLinks={pageLinks} onCursor={setCursor} />
    </Fragment>
  );
}

/**
 * Get a display name from user data with fallback priority:
 * email > username > ip_address > "Unknown"
 */
function getUserDisplayName(user: ConversationUser): string {
  return user.email || user.username || user.ip_address || t('Unknown');
}

function UserNotInstrumentedTooltip() {
  return (
    <Text>
      {tct(
        'User data not found. Call [code:sentry.setUser()] in your SDK to track users. [link:Learn more]',
        {
          code: <code />,
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/apis/" />
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
  const {openConversationViewDrawer} = useConversationViewDrawer();

  switch (column.key) {
    case 'conversationId':
      return (
        <ConversationIdButton
          priority="link"
          onClick={() => openConversationViewDrawer(dataRow)}
        >
          {dataRow.conversationId.slice(0, 8)}
        </ConversationIdButton>
      );
    case 'user':
      if (!dataRow.user) {
        return (
          <Tooltip title={<UserNotInstrumentedTooltip />} isHoverable>
            <Text variant="muted">&mdash;</Text>
          </Tooltip>
        );
      }
      return (
        <Flex align="center">
          <Tooltip title={getUserDisplayName(dataRow.user)} showOnlyOnOverflow>
            <Text ellipsis>{getUserDisplayName(dataRow.user)}</Text>
          </Tooltip>
        </Flex>
      );
    case 'inputOutput': {
      return (
        <InputOutputButton
          type="button"
          onClick={() => openConversationViewDrawer(dataRow)}
        >
          <Grid
            areas={`
              "inputLabel inputValue"
              "outputLabel outputValue"
            `}
            columns="min-content 1fr"
            gap="2xs md"
          >
            <Container area="inputLabel">
              <Text variant="muted">{t('Input')}</Text>
            </Container>
            <Container area="inputValue" minWidth="0px">
              <Tooltip
                title={dataRow.firstInput}
                disabled={!dataRow.firstInput}
                showOnlyOnOverflow
                maxWidth={800}
                isHoverable
                delay={500}
              >
                {dataRow.firstInput ? (
                  <Text ellipsis>{dataRow.firstInput}</Text>
                ) : (
                  <Text variant="muted">&mdash;</Text>
                )}
              </Tooltip>
            </Container>
            <Container area="outputLabel">
              <Text variant="muted">{t('Output')}</Text>
            </Container>
            <Container area="outputValue" minWidth="0px">
              <Tooltip
                title={dataRow.lastOutput}
                disabled={!dataRow.lastOutput}
                showOnlyOnOverflow
                maxWidth={800}
                isHoverable
                delay={500}
              >
                {dataRow.lastOutput ? (
                  <Text ellipsis>{dataRow.lastOutput}</Text>
                ) : (
                  <Text variant="muted">&mdash;</Text>
                )}
              </Tooltip>
            </Container>
          </Grid>
        </InputOutputButton>
      );
    }
    case 'duration':
      return <DurationCell milliseconds={dataRow.duration} />;
    case 'llmCalls':
    case 'toolCalls':
      return <NumberCell value={dataRow[column.key]} />;
    case 'tokensAndCost':
      return (
        <TextAlignRight>
          <Count value={dataRow.totalTokens} /> / <LLMCosts cost={dataRow.totalCost} />
        </TextAlignRight>
      );
    case 'timestamp':
      return (
        <TextAlignRight>
          <TimeSince unitStyle="extraShort" date={new Date(dataRow.timestamp)} />
        </TextAlignRight>
      );
    default:
      return null;
  }
});

const GridEditableContainer = styled('div')`
  position: relative;
  margin-bottom: ${p => p.theme.space.md};
`;

/**
 * Used to force the cell to expand take as much width as possible in the table layout
 * otherwise grid editable will let the last column grow
 */
const CellExpander = styled('div')`
  width: 100vw;
`;

const HeadCell = styled('div')<{align: 'left' | 'right'}>`
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  justify-content: ${p => (p.align === 'right' ? 'flex-end' : 'flex-start')};
`;

const ConversationIdButton = styled(Button)`
  font-weight: normal;
  padding: 0;
`;

const InputOutputButton = styled('button')`
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  width: 100%;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;
