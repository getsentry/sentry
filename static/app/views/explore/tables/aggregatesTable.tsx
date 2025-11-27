import {Fragment, useCallback, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconStack} from 'sentry/icons/iconStack';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {parseCursor} from 'sentry/utils/cursor';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
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
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
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
import {prettifyAggregation, viewSamplesTarget} from 'sentry/views/explore/utils';

interface AggregatesTableProps {
  aggregatesTableResult: AggregatesTableResult;
}

export function AggregatesTable({aggregatesTableResult}: AggregatesTableProps) {
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

  const meta = result.meta ?? {};

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const numberOfRowsNeedingColor = Math.min(result.data?.length ?? 0, TOP_EVENTS_LIMIT);

  const palette = theme.chart.getColorPalette(numberOfRowsNeedingColor - 1);

  const cursorHandler = useCallback<CursorHandler>(
    (cursor, path, q) =>
      navigate({pathname: path, query: {...q, [SPANS_AGGREGATE_CURSOR]: cursor}}),
    [navigate]
  );

  const paginationAnalyticsEvent = usePaginationAnalytics(
    'aggregates',
    result.data?.length ?? 0
  );

  const columns = useMemo(() => {
    return eventView.getColumns().reduce(
      (acc, col) => {
        acc[col.key] = col;
        return acc;
      },
      {} as Record<string, TableColumn<string>>
    );
  }, [eventView]);

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
              const label = prettifyField(field, stringTags, numberTags);

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
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </TableStatus>
          ) : result.isFetched && result.data?.length ? (
            result.data?.map((row, i) => {
              const target = viewSamplesTarget({
                location,
                query,
                fields,
                groupBys,
                visualizes,
                sorts,
                row,
                projects,
              });
              return (
                <TableRow key={i}>
                  <TableBodyCell>
                    {topEvents &&
                      i < topEvents &&
                      !parseCursor(aggregateCursor)?.offset && (
                        <TopResultsIndicator color={palette[i]!} />
                      )}
                    <Tooltip title={t('View Samples')} containerDisplayMode="flex">
                      <StyledLink to={target}>
                        <IconStack />
                      </StyledLink>
                    </Tooltip>
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
  numberTags: TagCollection
): string {
  const tag = stringTags[field] ?? numberTags[field] ?? null;
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

const StyledLink = styled(Link)`
  display: flex;
`;
