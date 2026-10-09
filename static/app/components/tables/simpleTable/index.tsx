import type {HTMLAttributes, MouseEvent, ReactNode, RefObject} from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import type {CSS} from '@sentry/scraps/cssTypes';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {fullWidthCellStyle, Table, type TableColumnConfig} from '@sentry/scraps/table';

import {
  type ColumnAlign,
  HeaderCellContent,
  type SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';
import {TableEmpty, TableError, TableLoading} from 'sentry/components/tables/statusRows';
import {defined} from 'sentry/utils/defined';
import {PanelProvider} from 'sentry/utils/panelProvider';

const HEADER_ROW_HEIGHT = 40;

type TableSectionsProps =
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

type TableProps = Omit<HTMLAttributes<HTMLTableElement>, 'children'> &
  TableSectionsProps & {
    children?: ReactNode;
    columns?: TableColumnConfig[];
    flexibleLastColumn?: boolean;
    maxHeight?: CSS['maxHeight'];
    minimumColumnWidth?: number;
    onColumnResize?: (index: number, width: number) => void;
    prependColumnWidths?: string[];
    ref?: RefObject<HTMLTableElement | null>;
    scrollable?: boolean;
  };

interface HeaderCellProps extends HTMLAttributes<HTMLTableCellElement> {
  align?: ColumnAlign;
  columnIndex?: number;
  divider?: boolean;
  handleSortClick?: (event: MouseEvent) => void;
  replace?: boolean;
  sort?: SortDirection;
  to?: LocationDescriptor;
  variant?: HeaderCellVariant;
}

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  ref?: RefObject<HTMLTableRowElement | null>;
  variant?: 'default' | 'faded';
}

type HeaderCellVariant = 'default' | 'first' | 'remaining' | 'full-width';

export function SimpleTable({
  children,
  columns,
  customSections,
  header,
  ...props
}: TableProps) {
  // Most tables have fixed layouts, so their columns resize only when they opt in.
  const resolvedColumns = columns?.map(column => ({resizable: false, ...column}));

  return (
    <StyledTable columns={resolvedColumns} {...props}>
      <PanelProvider>
        {customSections ? (
          children
        ) : (
          <Fragment>
            {header ? <Table.Head>{header}</Table.Head> : null}
            <Table.Body>{children}</Table.Body>
          </Fragment>
        )}
      </PanelProvider>
    </StyledTable>
  );
}

function HeaderCell({
  align,
  children,
  sort,
  handleSortClick,
  to,
  variant = 'default',
  divider = defined(children) ? true : false,
  ...props
}: HeaderCellProps) {
  return (
    <ColumnHeaderCell
      {...props}
      align={align}
      onSort={handleSortClick}
      overlays={
        <Fragment>
          {divider && <HeaderDivider />}
          {(handleSortClick || to) && <InteractionStateLayer />}
        </Fragment>
      }
      to={to}
      scope="col"
      sort={sort}
      variant={variant}
    >
      {children}
    </ColumnHeaderCell>
  );
}

function Row({children, variant = 'default', ref, ...props}: RowProps) {
  return (
    <StyledRow divider variant={variant} ref={ref} {...props}>
      {children}
    </StyledRow>
  );
}

function RowCell({children, ...props}: FlexProps<'td'>) {
  return (
    <Flex as="td" role="cell" align="center" overflow="hidden" padding="lg xl" {...props}>
      {children}
    </Flex>
  );
}

const StyledTable = styled(Table, {
  shouldForwardProp: prop => prop !== 'maxHeight' && prop !== 'scrollable',
})<{maxHeight?: CSS['maxHeight']; scrollable?: boolean}>`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  position: relative;
  margin: 0;
  width: 100%;
  overflow: ${p => (p.scrollable ? 'auto' : 'hidden')};

  ${p =>
    p.maxHeight &&
    css`
      max-height: ${p.maxHeight};
      min-height: 0;
    `}

  /* Pin the header to a definite track in tables that can scroll; a content-based
     header track lets Safari mis-size the <thead> on back/forward navigation. */
  ${p =>
    (p.scrollable || p.maxHeight) &&
    css`
      &:has(> thead + tbody) {
        grid-template-rows: ${HEADER_ROW_HEIGHT}px auto;
      }

      &:has(> thead + tbody + tbody) {
        grid-template-rows: ${HEADER_ROW_HEIGHT}px fit-content(100%) auto;
      }
    `}
`;

const StyledHeaderRow = styled(Table.Row)`
  background: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: calc(${p => p.theme.radius.md} + 1px)
    calc(${p => p.theme.radius.md} + 1px) 0 0;
  text-transform: none;
  justify-content: left;
  padding: 0;
  min-height: ${HEADER_ROW_HEIGHT}px;
  align-items: center;
`;

const StyledRow = styled(Table.Row, {
  shouldForwardProp: prop => prop !== 'variant',
})<{variant?: 'default' | 'faded'}>`
  align-items: center;

  ${p =>
    p.variant === 'faded' &&
    css`
      [role='cell'] {
        opacity: 0.8;
      }
    `}
`;

const HeaderDivider = styled('div')`
  position: absolute;
  left: 0;
  background-color: ${p => p.theme.colors.gray200};
  width: 1px;
  border-radius: ${p => p.theme.radius.md};
  height: 14px;
`;

const ColumnHeaderCell = styled(Table.HeadCell, {
  shouldForwardProp: prop => prop !== 'variant',
})<{variant: HeaderCellVariant; align?: ColumnAlign}>`
  outline: none;
  padding: 0 ${p => p.theme.space.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};

  display: flex;
  align-items: center;
  position: relative;
  justify-content: space-between;
  height: 100%;

  ${HeaderCellContent} {
    flex: 1;
    height: 100%;
    min-width: 0;
  }

  ${p =>
    !p.align &&
    css`
      ${HeaderCellContent} {
        justify-content: space-between;
      }
    `}

  ${HeaderCellContent}:focus-visible {
    box-shadow: inset 0 0 0 2px ${p => p.theme.tokens.focus.default};
  }

  &:first-child {
    ${HeaderDivider} {
      display: none;
    }
  }

  &[aria-sort] {
    color: ${p => p.theme.tokens.content.primary};
  }

  ${p =>
    p.variant === 'first' &&
    css`
      grid-column: 1;
    `}

  ${p =>
    p.variant === 'remaining' &&
    css`
      grid-column: 2 / -1;
    `}

  ${p =>
    p.variant === 'full-width' &&
    css`
      grid-column: 1 / -1;
      padding: 0;
    `}
`;

const rowLinkStyle = (p: {theme: Theme}) => css`
  /** Adjust margin/padding to account for StyledRowCell padding */
  margin: -${p.theme.space.lg} -${p.theme.space.xl};
  padding: ${p.theme.space.lg} ${p.theme.space.xl};

  /** Ensure cursor is set in case this is applied to a div */
  cursor: pointer;

  &:before {
    content: '';
    position: absolute;
    inset: 0;
  }
`;

const FullWidthCell = styled(RowCell)`
  grid-column: 1 / -1;
  ${fullWidthCellStyle}
`;

function FullWidthRow({children, ...props}: RowProps) {
  return (
    <Row {...props}>
      <FullWidthCell>{children}</FullWidthCell>
    </Row>
  );
}

SimpleTable.Body = Table.Body;
SimpleTable.Head = Table.Head;
SimpleTable.HeaderRow = StyledHeaderRow;
SimpleTable.HeaderCell = HeaderCell;
SimpleTable.Row = Row;
SimpleTable.RowCell = RowCell;
SimpleTable.rowLinkStyle = rowLinkStyle;
SimpleTable.Empty = TableEmpty;
SimpleTable.Error = TableError;
SimpleTable.Loading = TableLoading;
SimpleTable.FullWidthCell = FullWidthCell;
SimpleTable.FullWidthRow = FullWidthRow;
