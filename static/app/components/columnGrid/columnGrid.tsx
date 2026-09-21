import {Fragment, type ReactNode} from 'react';

import {Grid, type GridProps} from '@sentry/scraps/layout';

import {splitIntoColumns} from 'sentry/utils/array/splitIntoColumns';

interface ColumnGridProps<T> extends Omit<GridProps, 'align' | 'columns'> {
  columnCount: number;
  items: T[];
  renderColumn: (columnItems: T[], columnIndex: number) => ReactNode;
  /**
   * Set to '0' to keep columns equal width even when their content is wider.
   */
  columnMinWidth?: '0' | 'auto';
}

export function ColumnGrid<T>({
  children,
  columnCount,
  columnMinWidth = 'auto',
  items,
  renderColumn,
  ...props
}: ColumnGridProps<T>) {
  return (
    <Grid
      align="start"
      columns={`repeat(${columnCount}, minmax(${columnMinWidth}, 1fr))`}
      {...props}
    >
      {splitIntoColumns(items, columnCount).map((columnItems, columnIndex) => (
        <Fragment key={columnIndex}>{renderColumn(columnItems, columnIndex)}</Fragment>
      ))}
      {children}
    </Grid>
  );
}
