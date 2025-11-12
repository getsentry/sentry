import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/tables/gridEditable';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  AI_GENERATIONS_PAGE_FILTER,
  INPUT_OUTPUT_FIELD,
  type GenerationFields,
} from 'sentry/views/insights/aiGenerations/views/utils/constants';
import {Referrer} from 'sentry/views/insights/aiGenerations/views/utils/referrer';
import {useFieldsQueryParam} from 'sentry/views/insights/aiGenerations/views/utils/useFieldsQueryParam';
import {TextAlignRight} from 'sentry/views/insights/common/components/textAlign';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {useTraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import {
  HeadSortCell,
  useTableSort,
} from 'sentry/views/insights/pages/agents/components/headSortCell';
import {ModelName} from 'sentry/views/insights/pages/agents/components/modelName';
import {useCombinedQuery} from 'sentry/views/insights/pages/agents/hooks/useCombinedQuery';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';
import {PlatformInsightsTable} from 'sentry/views/insights/pages/platform/shared/table';
import {SpanFields} from 'sentry/views/insights/types';

const columnWidths: Partial<Record<GenerationFields, number>> = {
  [SpanFields.ID]: 100,
  [INPUT_OUTPUT_FIELD]: COL_WIDTH_UNDEFINED,
  [SpanFields.GEN_AI_REQUEST_MODEL]: 200,
};

const prettyFieldNames: Partial<Record<GenerationFields, string>> = {
  [SpanFields.GEN_AI_REQUEST_MODEL]: t('Model'),
};

const DEFAULT_SORT: Sort = {field: SpanFields.TIMESTAMP, kind: 'desc'};

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

const REQUIRED_FIELDS = [
  SpanFields.SPAN_STATUS,
  SpanFields.PROJECT,
  SpanFields.TIMESTAMP,
  SpanFields.TRACE,
  SpanFields.ID,
  SpanFields.GEN_AI_REQUEST_MESSAGES,
  SpanFields.GEN_AI_RESPONSE_TEXT,
  SpanFields.GEN_AI_RESPONSE_OBJECT,
];

export function GenerationsTable() {
  const {openTraceViewDrawer} = useTraceViewDrawer({});
  const query = useCombinedQuery(AI_GENERATIONS_PAGE_FILTER);
  const {cursor} = useTableCursor();
  const {tableSort} = useTableSort(DEFAULT_SORT);
  const [fields] = useFieldsQueryParam();
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();
  const {selection} = usePageFilters();
  const [caseInsensitive] = useCaseInsensitivity();

  const fieldsToQuery = useMemo(() => {
    return [
      ...fields.filter(
        (field): field is SpanFields =>
          field !== INPUT_OUTPUT_FIELD && !REQUIRED_FIELDS.includes(field)
      ),
    ];
  }, [fields]);

  const eventView = useMemo(() => {
    const queryFields = [...REQUIRED_FIELDS, ...fieldsToQuery];

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'AI Generations',
      fields: queryFields,
      orderby: [`${tableSort.kind === 'desc' ? '-' : ''}${tableSort.field}`],
      query,
      version: 2,
      dataset: DiscoverDatasets.SPANS,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [fieldsToQuery, query, selection, tableSort.field, tableSort.kind]);

  const {
    data = [],
    meta,
    isLoading,
    error,
    pageLinks,
    isPlaceholderData,
  } = useSpansQuery<Array<Record<string, any>>>({
    eventView,
    cursor,
    limit: 20,
    referrer: Referrer.GENERATIONS_TABLE,
    initialData: [],
    allowAggregateConditions: false,
    trackResponseAnalytics: false,
    queryExtras: {caseInsensitive},
  });

  type TableData = Record<string, any>;

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      if (column.key === SpanFields.ID) {
        return (
          <div>
            <Button
              priority="link"
              onClick={() => {
                openTraceViewDrawer(
                  dataRow.trace,
                  dataRow.id,
                  getTimeStampFromTableDateField(dataRow.timestamp)
                );
              }}
            >
              {getShortEventId(dataRow.id)}
            </Button>
          </div>
        );
      }

      if (column.key === INPUT_OUTPUT_FIELD) {
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
            <TimeSince unitStyle="short" date={new Date(dataRow.timestamp)} />
          </TextAlignRight>
        );
      }
      const fieldRenderer = getFieldRenderer(column.key, meta!);
      return fieldRenderer(dataRow, {
        location,
        organization,
        theme,
        projectSlug: dataRow.project,
      });
    },
    [openTraceViewDrawer, meta, location, organization, theme]
  );

  const renderHeadCell = useCallback(
    (column: GridColumnOrder<string>) => {
      return (
        <HeadSortCell
          align={column.key === SpanFields.TIMESTAMP ? 'right' : 'left'}
          currentSort={tableSort}
          sortKey={column.key}
          forceCellGrow={column.key === INPUT_OUTPUT_FIELD}
        >
          {column.name}
        </HeadSortCell>
      );
    },
    [tableSort]
  );

  return (
    <Container>
      <PlatformInsightsTable
        key={fields.join(',')}
        data={data}
        stickyHeader
        isLoading={isLoading}
        error={error}
        initialColumnOrder={fields.map(
          (field): GridColumnOrder<string> => ({
            key: field,
            name: prettyFieldNames[field] ?? field,
            width: columnWidths[field] ?? COL_WIDTH_UNDEFINED,
          })
        )}
        pageLinks={pageLinks}
        grid={{
          renderBodyCell,
          renderHeadCell,
        }}
        isPlaceholderData={isPlaceholderData}
      />
    </Container>
  );
}
