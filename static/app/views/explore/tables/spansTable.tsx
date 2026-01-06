import {Fragment, useMemo, useRef} from 'react';

import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
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
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {usePaginationAnalytics} from 'sentry/views/explore/hooks/usePaginationAnalytics';
import {
  useQueryParamsFields,
  useQueryParamsSortBys,
  useSetQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

import {FieldRenderer} from './fieldRenderer';

interface SpansTableProps {
  spansTableResult: SpansTableResult;
}

export function SpansTable({spansTableResult}: SpansTableProps) {
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const setSortBys = useSetQueryParamsSortBys();

  const visibleFields = useMemo(
    () => (fields.includes('id') ? [...fields] : ['id', ...fields]),
    [fields]
  );

  const {result, eventView} = spansTableResult;

  const columnsFromEventView = useMemo(() => eventView.getColumns(), [eventView]);

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(
    visibleFields,
    tableRef,
    {minimumColumnWidth: 50}
  );

  const meta = result.meta ?? {};

  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const paginationAnalyticsEvent = usePaginationAnalytics(
    'samples',
    result.data?.length ?? 0
  );

  return (
    <Fragment>
      <Table ref={tableRef} style={initialTableStyles} data-test-id="spans-table">
        <TableHead>
          <TableRow>
            {visibleFields.map((field, i) => {
              // Hide column names before alignment is determined
              if (result.isPending) {
                return <TableHeadCell key={i} isFirst={i === 0} />;
              }

              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const tag = stringTags[field] ?? numberTags[field] ?? null;

              const direction = sortBys.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSortBys([{field, kind}]);
              }

              const label = tag?.name ?? prettifyTagKey(field);

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
                  {i !== visibleFields.length - 1 && (
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
            result.data?.map((row, i) => (
              <TableRow key={i}>
                {visibleFields.map((field, j) => {
                  return (
                    <TableBodyCell key={j}>
                      <FieldRenderer
                        column={columnsFromEventView[j]}
                        data={row}
                        unit={meta?.units?.[field]}
                        meta={meta}
                      />
                    </TableBodyCell>
                  );
                })}
              </TableRow>
            ))
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
      />
    </Fragment>
  );
}
