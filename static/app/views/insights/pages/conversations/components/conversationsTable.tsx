import {Fragment, memo, useCallback} from 'react';
import styled from '@emotion/styled';

import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Button} from 'sentry/components/core/button';
import Pagination from 'sentry/components/pagination';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import useStateBasedColumnResize from 'sentry/components/tables/gridEditable/useStateBasedColumnResize';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {LLMCosts} from 'sentry/views/insights/pages/agents/components/llmCosts';
import {ErrorCell} from 'sentry/views/insights/pages/agents/utils/cells';
import {hasGenAiConversationsFeature} from 'sentry/views/insights/pages/agents/utils/features';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {useConversationViewDrawer} from 'sentry/views/insights/pages/conversations/components/conversationDrawer';
import {
  useConversations,
  type Conversation,
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
  {key: 'inputOutput', name: t('Input / Output'), width: COL_WIDTH_UNDEFINED},
  {key: 'duration', name: t('Duration'), width: 130},
  {key: 'errors', name: t('Errors'), width: 100},
  {key: 'llmCalls', name: t('LLM Calls'), width: 110},
  {key: 'toolCalls', name: t('Tool Calls'), width: 110},
  {key: 'totalTokens', name: t('Total Tokens'), width: 120},
  {key: 'totalCost', name: t('Total Cost'), width: 120},
  {key: 'timestamp', name: t('Last Message'), width: 120},
];

const rightAlignColumns = new Set([
  'errors',
  'llmCalls',
  'toolCalls',
  'totalTokens',
  'totalCost',
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

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
}: {
  column: GridColumnHeader<string>;
  dataRow: Conversation;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
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
    case 'inputOutput': {
      return (
        <div>
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
              >
                {dataRow.lastOutput ? (
                  <Text ellipsis>{dataRow.lastOutput}</Text>
                ) : (
                  <Text variant="muted">&mdash;</Text>
                )}
              </Tooltip>
            </Container>
          </Grid>
        </div>
      );
    }
    case 'duration':
      return <DurationCell milliseconds={dataRow.duration} />;
    case 'errors':
      return (
        <ErrorCell
          value={dataRow.errors}
          target={getExploreUrl({
            query: `span.status:internal_error trace:[${dataRow.traceIds.join(',')}]`,
            organization,
            selection,
            referrer: Referrer.TRACES_TABLE,
          })}
          isLoading={false}
        />
      );
    case 'llmCalls':
    case 'toolCalls':
    case 'totalTokens':
      return <NumberCell value={dataRow[column.key]} />;
    case 'totalCost':
      return (
        <TextAlignRight>
          <LLMCosts cost={dataRow.totalCost} />
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
