import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {getShortEventId} from 'sentry/utils/events';
import {useTraceViewDrawer} from 'sentry/views/insights/agents/components/drawer';
import {HeadSortCell} from 'sentry/views/insights/agents/components/headSortCell';
import {ModelName} from 'sentry/views/insights/agents/components/modelName';
import {useCombinedQuery} from 'sentry/views/insights/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/agents/hooks/useTableCursor';
import {AI_GENERATIONS_PAGE_FILTER} from 'sentry/views/insights/aiGenerations/views/utils/constants';
import {Referrer} from 'sentry/views/insights/aiGenerations/views/utils/referrer';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {PlatformInsightsTable} from 'sentry/views/insights/pages/platform/shared/table';
import {SpanFields} from 'sentry/views/insights/types';

const INITIAL_COLUMN_ORDER = [
  {key: SpanFields.SPAN_ID, name: t('Span ID'), width: 100},
  {
    key: SpanFields.GEN_AI_REQUEST_MESSAGES,
    name: t('Input / Output'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: SpanFields.GEN_AI_REQUEST_MODEL,
    name: t('Model'),
    width: 200,
  },
  {key: SpanFields.TIMESTAMP, name: t('Timestamp')},
] as const;

function getLastInputMessage(messages?: string) {
  if (!messages) {
    return null;
  }
  try {
    const messagesArray = JSON.parse(messages);
    const lastInputMessage =
      messagesArray.findLast((message: any) => message.role === 'user')?.content ||
      messagesArray.findLast((message: any) => message.role === 'system')?.content;
    return typeof lastInputMessage === 'string'
      ? lastInputMessage
      : lastInputMessage[0].text.toString();
  } catch (error) {
    return messages;
  }
}

export function GenerationsTable() {
  const {openTraceViewDrawer} = useTraceViewDrawer({});
  const query = useCombinedQuery(AI_GENERATIONS_PAGE_FILTER);
  const {cursor} = useTableCursor();

  const {data, isLoading, error, pageLinks, isPlaceholderData} = useSpans(
    {
      search: query,
      fields: [
        SpanFields.TRACE,
        SpanFields.SPAN_ID,
        SpanFields.SPAN_STATUS,
        SpanFields.SPAN_DESCRIPTION,
        SpanFields.GEN_AI_REQUEST_MESSAGES,
        SpanFields.GEN_AI_RESPONSE_TEXT,
        SpanFields.GEN_AI_RESPONSE_OBJECT,
        SpanFields.GEN_AI_REQUEST_MODEL,
        SpanFields.TIMESTAMP,
      ],
      cursor,
      keepPreviousData: true,
      limit: 20,
    },
    Referrer.GENERATIONS_TABLE
  );

  type TableData = (typeof data)[number];

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<keyof TableData>, dataRow: TableData) => {
      if (column.key === SpanFields.SPAN_ID) {
        return (
          <div>
            <Button
              priority="link"
              onClick={() => {
                openTraceViewDrawer(
                  dataRow.trace,
                  dataRow.span_id,
                  getTimeStampFromTableDateField(dataRow.timestamp)
                );
              }}
            >
              {getShortEventId(dataRow.span_id)}
            </Button>
          </div>
        );
      }

      if (column.key === SpanFields.GEN_AI_REQUEST_MESSAGES) {
        const noValueFallback = <Text variant="muted">–</Text>;
        const statusValue = dataRow[SpanFields.SPAN_STATUS];
        const isError = statusValue && statusValue !== 'ok' && statusValue !== 'unknown';

        const userMessage = getLastInputMessage(
          dataRow[SpanFields.GEN_AI_REQUEST_MESSAGES]
        );
        const outputValue =
          dataRow[SpanFields.GEN_AI_RESPONSE_TEXT] ||
          dataRow[SpanFields.GEN_AI_RESPONSE_OBJECT];
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
                <Text variant="muted">Input</Text>
              </Container>
              <Container area="inputValue" minWidth="0px">
                <Tooltip
                  title={userMessage}
                  disabled={!userMessage}
                  showOnlyOnOverflow
                  maxWidth={800}
                  isHoverable
                >
                  <Text ellipsis>{userMessage || noValueFallback}</Text>
                </Tooltip>
              </Container>
              <Container area="outputLabel">
                <Text variant="muted">Output</Text>
              </Container>
              <Container area="outputValue" minWidth="0px">
                <Tooltip
                  title={outputValue}
                  disabled={!outputValue}
                  showOnlyOnOverflow
                  maxWidth={800}
                  isHoverable
                >
                  {isError ? (
                    <Text variant="danger">{statusValue}</Text>
                  ) : (
                    <Text ellipsis>{outputValue || noValueFallback}</Text>
                  )}
                </Tooltip>
              </Container>
            </Grid>
          </div>
        );
      }

      if (column.key === SpanFields.GEN_AI_REQUEST_MODEL) {
        return <ModelName modelId={dataRow[column.key] || '(no value)'} />;
      }
      if (column.key === SpanFields.TIMESTAMP) {
        return (
          <TextAlignRight>
            <TimeSince unitStyle="extraShort" date={new Date(dataRow.timestamp)} />
          </TextAlignRight>
        );
      }
      return <div>{dataRow[column.key]}</div>;
    },
    [openTraceViewDrawer]
  );

  const renderHeadCell = useCallback((column: GridColumnOrder<keyof TableData>) => {
    return (
      <HeadSortCell
        align={column.key === SpanFields.TIMESTAMP ? 'right' : 'left'}
        sortKey={column.key}
        forceCellGrow={column.key === SpanFields.GEN_AI_REQUEST_MESSAGES}
      >
        {column.name}
      </HeadSortCell>
    );
  }, []);

  return (
    <div>
      <PlatformInsightsTable
        data={data}
        stickyHeader
        isLoading={isLoading}
        error={error}
        initialColumnOrder={INITIAL_COLUMN_ORDER as any}
        pageLinks={pageLinks}
        grid={{
          renderBodyCell,
          renderHeadCell,
        }}
        isPlaceholderData={isPlaceholderData}
      />
    </div>
  );
}
