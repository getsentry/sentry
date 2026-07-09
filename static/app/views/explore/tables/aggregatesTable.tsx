import {Fragment, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Pagination, type CursorHandler} from '@sentry/scraps/pagination';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconStack} from 'sentry/icons/iconStack';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {parseCursor} from 'sentry/utils/cursor';
import {defined} from 'sentry/utils/defined';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {prettifyTagKey, type FieldValueType} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {CellAction} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {
  Table,
  TableBody,
  TableBodyCell,
  TableHead,
  TableHeadCell,
  TableHeadCellContent,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {isGroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {usePaginationAnalytics} from 'sentry/views/explore/hooks/usePaginationAnalytics';
import {TOP_EVENTS_LIMIT, useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {
  useQueryParamsAggregateCursor,
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsFields,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useQueryParamsVisualizes,
  useSetQueryParamsAggregateSortBys,
} from 'sentry/views/explore/queryParams/context';
import {SPANS_AGGREGATE_CURSOR} from 'sentry/views/explore/spans/spansQueryParams';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {addValidatedFieldTypesToMeta} from 'sentry/views/explore/tables/spansTable';
import {prettifyAggregation, viewSamplesTarget} from 'sentry/views/explore/utils';
import {SpanFields} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface AggregatesTableProps {
  aggregatesTableResult: AggregatesTableResult;
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  validatedFieldTypes: Partial<Record<string, FieldValueType>>;
}

export function AggregatesTable({
  aggregatesTableResult,
  booleanTags,
  numberTags,
  stringTags,
  validatedFieldTypes,
}: AggregatesTableProps) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const {projects} = useProjects();

  const {result, eventView} = aggregatesTableResult;

  const topEvents = useTopEvents();
  const aggregateFields = useQueryParamsAggregateFields();
  const fields = useQueryParamsFields();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const sorts = useQueryParamsAggregateSortBys();
  const setSorts = useSetQueryParamsAggregateSortBys();
  const query = useQueryParamsQuery();
  const aggregateCursor = useQueryParamsAggregateCursor();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const visibleAggregateFields = useMemo(
    () =>
      aggregateFields.filter(aggregateField => {
        if (isGroupBy(aggregateField)) {
          return Boolean(aggregateField.groupBy);
        }
        return true;
      }),
    [aggregateFields]
  );

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(
    visibleAggregateFields.map(aggregateField => {
      if (isGroupBy(aggregateField)) {
        return aggregateField.groupBy;
      }
      return aggregateField.yAxis;
    }),
    tableRef,
    {
      minimumColumnWidth: 50,
      prefixColumnWidth: 'min-content',
    }
  );

  const meta = useMemo(
    () =>
      addValidatedFieldTypesToMeta({
        meta: result.meta ?? {},
        validatedFieldTypes,
      }),
    [result.meta, validatedFieldTypes]
  );

  const numberOfRowsNeedingColor = Math.min(result.data?.length ?? 0, TOP_EVENTS_LIMIT);

  const palette = theme.chart.getColorPalette(numberOfRowsNeedingColor - 1);

  const cursorHandler: CursorHandler = (cursor, path, q) =>
    navigate({pathname: path, query: {...q, [SPANS_AGGREGATE_CURSOR]: cursor}});

  const paginationAnalyticsEvent = usePaginationAnalytics(
    'aggregates',
    result.data?.length ?? 0
  );

  const columns = useMemo(() => {
    return eventView
      .getColumns(meta)
      .reduce<Record<string, TableColumn<string>>>((acc, col) => {
        acc[col.key] = col;
        return acc;
      }, {});
  }, [eventView, meta]);

  return (
    <Fragment>
      <Table ref={tableRef} style={initialTableStyles}>
        <TableHead>
          <TableRow>
            <TableHeadCell isFirst={false}>
              <TableHeadCellContent />
            </TableHeadCell>
            {visibleAggregateFields.map((aggregateField, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              const field = isGroupBy(aggregateField)
                ? aggregateField.groupBy
                : aggregateField.yAxis;

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const label = prettifyField(field, stringTags, numberTags, booleanTags);

              const direction = sorts.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSorts([{field, kind}]);
              }

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <TableHeadCellContent onClick={updateSort}>
                    <Tooltip showOnlyOnOverflow title={label}>
                      {label}
                    </Tooltip>
                    {defined(direction) && (
                      <IconArrow
                        size="xs"
                        direction={
                          direction === 'desc'
                            ? 'down'
                            : direction === 'asc'
                              ? 'up'
                              : undefined
                        }
                      />
                    )}
                  </TableHeadCellContent>
                  {i !== visibleAggregateFields.length - 1 && (
                    <GridResizer
                      dataRows={
                        !result.isError && !result.isPending && result.data
                          ? result.data.length
                          : 0
                      }
                      onMouseDown={e => onResizeMouseDown(e, i)}
                    />
                  )}
                </TableHeadCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.isPending ? (
            <TableStatus>
              <LoadingIndicator />
            </TableStatus>
          ) : result.isError ? (
            <TableStatus>
              <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
            </TableStatus>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => {
              const menuItems: MenuItemProps[] = [
                {
                  key: 'view-samples',
                  label: t('View Samples'),
                  to: viewSamplesTarget({
                    location,
                    query,
                    fields,
                    groupBys,
                    visualizes,
                    sorts,
                    row,
                    projects,
                  }),
                },
              ];

              const traceSlug = row[`any(${SpanFields.TRACE})`];
              const timestamp = row[`any(${SpanFields.TIMESTAMP})`];
              if (traceSlug && timestamp) {
                menuItems.push({
                  key: 'view-random-trace',
                  label: t('View Random Trace'),
                  to: getTraceDetailsUrl({
                    organization,
                    traceSlug,
                    timestamp,
                    targetId: undefined,
                    eventId: undefined,
                    location,
                    source: TraceViewSources.TRACES,
                    dateSelection: normalizeDateTimeParams(selection.datetime),
                  }),
                });
              }

              return (
                <TableRow key={i}>
                  <TableBodyCell>
                    {topEvents &&
                      i < topEvents &&
                      !parseCursor(aggregateCursor)?.offset && (
                        <TopResultsIndicator color={palette[i]!} />
                      )}
                    <CellAction
                      column={VIEW_SAMPLES_COLUMN}
                      dataRow={row}
                      handleCellAction={() => null}
                      allowActions={[]}
                      extraMenuItems={menuItems}
                    >
                      <IconTriggerContent>
                        <IconStack />
                      </IconTriggerContent>
                    </CellAction>
                  </TableBodyCell>
                  {visibleAggregateFields.map((aggregateField, j) => {
                    const field = isGroupBy(aggregateField)
                      ? aggregateField.groupBy
                      : aggregateField.yAxis;

                    return (
                      <TableBodyCell key={j}>
                        <FieldRenderer
                          column={columns[field]}
                          data={row}
                          unit={meta?.units?.[field]}
                          meta={meta}
                        />
                      </TableBodyCell>
                    );
                  })}
                </TableRow>
              );
            })
          ) : (
            <TableStatus>
              <EmptyStateWarning>
                <p>{t('No spans found')}</p>
              </EmptyStateWarning>
            </TableStatus>
          )}
        </TableBody>
      </Table>
      <Pagination
        pageLinks={result.pageLinks}
        paginationAnalyticsEvent={paginationAnalyticsEvent}
        onCursor={cursorHandler}
      />
    </Fragment>
  );
}

function prettifyField(
  field: string,
  stringTags: TagCollection,
  numberTags: TagCollection,
  booleanTags: TagCollection
): string {
  const tag = stringTags[field] ?? numberTags[field] ?? booleanTags[field] ?? null;
  if (tag) {
    return tag.name;
  }

  return prettifyAggregation(field) ?? prettifyTagKey(field);
}

const TopResultsIndicator = styled('div')<{color: string}>`
  position: absolute;
  left: -1px;
  width: 9px;
  height: 16px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => p.color};
`;

const IconTriggerContent = styled('span')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  line-height: 0;
`;

const VIEW_SAMPLES_COLUMN: TableColumn<keyof TableDataRow> = {
  key: 'view-samples',
  name: 'view-samples',
  column: {kind: 'field', field: 'view-samples'},
  isSortable: false,
  type: 'string',
};
