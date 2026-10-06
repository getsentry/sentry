import type {ComponentProps, ReactNode, RefObject} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {CSS} from '@sentry/scraps/cssTypes';
import {
  COL_WIDTH_MINIMUM,
  Table,
  type TableColumnConfig,
  TABLE_HEAD_ROW_HEIGHT,
  TableResizer,
} from '@sentry/scraps/table';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {HeaderCellContent} from 'sentry/components/tables/sortableHeaderCell';
import {TableEmpty, TableError, TableLoading} from 'sentry/components/tables/statusRows';
import {
  type TableHeaderCellProps,
  type TableRowProps,
  TableSections,
  type TableSectionsProps,
} from 'sentry/components/tables/tableParts';

export const DATA_TABLE_ROW_HEIGHT = 42;

const Frame = styled(
  ({
    children,
    contentsBody,
    showVerticalScrollbar: _,
    ...props
  }: React.ComponentProps<typeof Panel> & {
    children?: ReactNode;
    contentsBody?: boolean;
    showVerticalScrollbar?: boolean;
  }) => (
    <Panel {...props}>
      <PanelBody display={contentsBody ? 'contents' : undefined}>{children}</PanelBody>
    </Panel>
  )
)`
  overflow-x: auto;
  overflow-y: ${({showVerticalScrollbar}) => (showVerticalScrollbar ? 'auto' : 'hidden')};
`;

/**
 * The shared shell owns column tracks only, so the row tracks, scroll containment
 * and sizing that these tables want are declared here.
 */
const Grid = styled(Table, {
  shouldForwardProp: prop => prop !== 'fit' && prop !== 'height' && prop !== 'scrollable',
})<{
  fit?: 'max-content';
  height?: CSS['height'];
  scrollable?: boolean;
}>`
  ${p =>
    p.scrollable &&
    css`
      overflow-x: auto;
      overflow-y: auto;
    `}

  /* Pin the header to a definite track height in both layouts; a content-based
     header track lets Safari mis-size the <thead> on back/forward navigation.
     Body track: 1fr absorbs slack when a height is given, else auto. */
  ${p =>
    p.height
      ? css`
          height: 100%;
          max-height: ${p.height};
          flex: 1;
          min-height: 0;

          &:has(> thead + tbody) {
            grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px 1fr;
          }

          &:has(> thead + tbody + tbody) {
            grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px fit-content(100%) 1fr;
          }
        `
      : css`
          &:has(> thead + tbody) {
            grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px auto;
          }

          &:has(> thead + tbody + tbody) {
            grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px fit-content(100%) auto;
          }
        `}

  min-width: ${p => p.fit};
`;

const Head = styled(Table.Head)`
  background-color: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1;
  text-transform: uppercase;
  user-select: none;
  color: ${p => p.theme.tokens.content.secondary};

  border-top-left-radius: ${p => p.theme.radius.md};
  border-top-right-radius: ${p => p.theme.radius.md};
`;

function HeaderCell({children, handleSortClick, ...props}: TableHeaderCellProps) {
  return (
    <StyledHeaderCell {...props} onSort={handleSortClick} scope="col">
      {children}
    </StyledHeaderCell>
  );
}

const StyledHeaderCell = styled(Table.HeadCell)`
  height: ${TABLE_HEAD_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  min-width: 24px;
  padding: 0 ${p => p.theme.space.xl};

  border-right: 1px solid transparent;
  border-left: 1px solid transparent;

  a,
  div,
  span {
    line-height: 1.1;
    color: inherit;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  /* Truncating every div would clip the resize handle's hit area back to the line. */
  ${TableResizer}, ${TableResizer} div {
    overflow: visible;
  }

  &:last-child {
    border-right: none;
  }

  &:hover {
    border-right-color: ${p => p.theme.tokens.border.primary};
  }

  &:not(:first-child):hover {
    border-left-color: ${p => p.theme.tokens.border.primary};
  }

  svg {
    min-width: 12px;
  }

  ${HeaderCellContent} > svg {
    align-self: flex-start;
  }
`;

function Row({children, ...props}: TableRowProps) {
  return (
    <StyledRow divider {...props}>
      {children}
    </StyledRow>
  );
}

const StyledRow = styled(Table.Row)`
  &:not(thead > &) {
    background-color: ${p => p.theme.tokens.background.primary};

    &:last-child {
      border-bottom-left-radius: ${p => p.theme.radius.md};
      border-bottom-right-radius: ${p => p.theme.radius.md};
    }
  }
`;

const RowCell = styled(Table.Cell)`
  /* Locking in the height makes calculation for resizer to be easier.
     min-height is used to allow a cell to expand and this is used to display
     feedback during empty/error state */
  min-height: ${DATA_TABLE_ROW_HEIGHT}px;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

  display: flex;
  flex-direction: column;
  justify-content: center;

  font-size: ${p => p.theme.font.size.md};
`;

type DataTableProps = Omit<ComponentProps<typeof Frame>, 'children' | 'height'> &
  TableSectionsProps & {
    children?: ReactNode;
    columns?: TableColumnConfig[];
    height?: CSS['height'];
    minimumColumnWidth?: number;
    prependColumnWidths?: string[];
    ref?: RefObject<HTMLTableElement | null>;
    scrollable?: boolean;
  };

export function DataTable({
  children,
  columns,
  customSections,
  header,
  height,
  minimumColumnWidth = COL_WIDTH_MINIMUM,
  prependColumnWidths,
  ref,
  scrollable,
  ...props
}: DataTableProps) {
  return (
    <Frame {...props}>
      <Grid
        columns={columns}
        flexibleLastColumn={false}
        height={height}
        minimumColumnWidth={minimumColumnWidth}
        prependColumnWidths={prependColumnWidths}
        ref={ref}
        scrollable={scrollable}
      >
        <TableSections
          body={Table.Body}
          customSections={customSections}
          head={Head}
          header={header}
        >
          {children}
        </TableSections>
      </Grid>
    </Frame>
  );
}

DataTable.Body = Table.Body;
DataTable.Empty = TableEmpty;
DataTable.Error = TableError;
DataTable.Frame = Frame;
DataTable.Grid = Grid;
DataTable.Head = Head;
DataTable.HeaderCell = HeaderCell;
DataTable.HeaderRow = Table.Row;
DataTable.Loading = TableLoading;
DataTable.Row = Row;
DataTable.RowCell = RowCell;
