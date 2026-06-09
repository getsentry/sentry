import {Fragment, useRef} from 'react';

import {Tooltip} from '@sentry/scraps/tooltip';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {Pagination} from 'sentry/components/pagination';
import {GridResizer} from 'sentry/components/tables/gridEditable/styles';
import {t} from 'sentry/locale';
import {prettifyTagKey} from 'sentry/utils/fields';
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

export function ErrorsTable() {
  const visibleFields = ['id'];

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles, onResizeMouseDown} = useTableStyles(
    visibleFields,
    tableRef,
    {minimumColumnWidth: 50}
  );

  return (
    <Fragment>
      <Table ref={tableRef} style={initialTableStyles} data-test-id="errors-table">
        <TableHead>
          <TableRow>
            {visibleFields.map((field, i) => {
              // TODO: Hide column names before alignment is determined

              function updateSort() {}

              const label = prettifyTagKey(field);

              return (
                <TableHeadCell key={i} isFirst={i === 0}>
                  <TableHeadCellContent onClick={updateSort}>
                    <Tooltip showOnlyOnOverflow title={label}>
                      {label}
                    </Tooltip>
                    {/* TODO: Add sort direction arrow */}
                  </TableHeadCellContent>
                  {i !== visibleFields.length - 1 && (
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
      <Pagination />
    </Fragment>
  );
}
