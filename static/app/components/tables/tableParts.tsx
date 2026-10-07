import type {
  ComponentProps,
  ComponentType,
  HTMLAttributes,
  MouseEvent,
  ReactNode,
  RefObject,
} from 'react';
import {Fragment} from 'react';
import type {LocationDescriptor} from 'history';

import {Table} from '@sentry/scraps/table';

import type {
  ColumnAlign,
  SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';
import type {
  TableEmpty,
  TableError,
  TableLoading,
} from 'sentry/components/tables/statusRows';

export type TableSectionsProps =
  | {
      /**
       * Render `children` as the table's sections, such as its `Head` and `Body`,
       * instead of as the rows of a single body.
       */
      customSections: true;
      header?: never;
    }
  | {
      customSections?: false;
      /** The header row, rendered into the table's `<thead>`. */
      header?: ReactNode;
    };

export function TableSections({
  children,
  customSections,
  head: Head,
  header,
}: {
  head: ComponentType<{children?: ReactNode}>;
  children?: ReactNode;
  customSections?: boolean;
  header?: ReactNode;
}) {
  if (customSections) {
    return children;
  }

  return (
    <Fragment>
      {header ? <Head>{header}</Head> : null}
      <Table.Body>{children}</Table.Body>
    </Fragment>
  );
}

export interface TableHeaderCellProps extends HTMLAttributes<HTMLTableCellElement> {
  align?: ColumnAlign;
  columnIndex?: number;
  handleSortClick?: (event: MouseEvent) => void;
  replace?: boolean;
  sort?: SortDirection;
  to?: LocationDescriptor;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  ref?: RefObject<HTMLTableRowElement | null>;
}

/**
 * The parts that `SimpleTable` and `DataTable` both provide, so that a component
 * such as `GridEditable` can render either one.
 */
export interface TableParts {
  Body: ComponentType<ComponentProps<typeof Table.Body>>;
  Empty: typeof TableEmpty;
  Error: typeof TableError;
  Head: ComponentType<ComponentProps<typeof Table.Head>>;
  HeaderCell: ComponentType<TableHeaderCellProps>;
  HeaderRow: ComponentType<HTMLAttributes<HTMLTableRowElement>>;
  Loading: typeof TableLoading;
  Row: ComponentType<TableRowProps>;
  RowCell: ComponentType<HTMLAttributes<HTMLTableCellElement>>;
}
