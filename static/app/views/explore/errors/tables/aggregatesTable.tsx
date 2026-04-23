import {Fragment, useCallback, useRef} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {Pagination, type CursorHandler} from 'sentry/components/pagination';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {t} from 'sentry/locale';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  Table,
  TableBody,
  TableHead,
  TableHeadCell,
  TableHeadCellContent,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';

export function AggregatesTable() {
  const navigate = useNavigate();

  const visibleAggregateFields = ['count(errors)'];

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(
    visibleAggregateFields,
    tableRef,
    {
      minimumColumnWidth: 50,
      prefixColumnWidth: 'min-content',
    }
  );

  const cursorHandler = useCallback<CursorHandler>(
    (cursor, path, q) =>
      navigate({pathname: path, query: {...q, ['errors_aggregate_cursor']: cursor}}),
    [navigate]
  );

  return (
    <Fragment>
      <Table ref={tableRef} style={initialTableStyles} data-test-id="aggregates-table">
        <TableHead>
          <TableRow>
            <TableHeadCell isFirst={false}>
              <TableHeadCellContent />
            </TableHeadCell>
            {visibleAggregateFields.map((aggregateField, i) => {
              // TODO: Hide column names before alignment is determined

              // TODO: add sort handling
              function updateSort() {}

              return (
                <TableHeadCell key={i} isFirst={i === 0}>
                  <TableHeadCellContent onClick={updateSort}>
                    <Tooltip showOnlyOnOverflow title={aggregateField}>
                      {aggregateField}
                    </Tooltip>
                    {/* TODO: Add sort direction arrow */}
                  </TableHeadCellContent>
                  {i !== visibleAggregateFields.length - 1 && (
                    <GridResizer
                      dataRows={0}
                      onMouseDown={e => onResizeMouseDown(e, i)}
                    />
                  )}
                </TableHeadCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableStatus>
            <EmptyStateWarning>
              <p>{t('No errors found')}</p>
            </EmptyStateWarning>
          </TableStatus>
        </TableBody>
      </Table>
      <Pagination onCursor={cursorHandler} />
    </Fragment>
  );
}
