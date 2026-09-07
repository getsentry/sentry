import type {ComponentProps, HTMLAttributes, ReactNode, RefObject} from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex} from '@sentry/scraps/layout';
import {
  emptyCellStyle,
  fullWidthCellStyle,
  Table,
  type TableColumnConfig,
} from '@sentry/scraps/table';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {ColumnAlign} from 'sentry/components/tables/gridEditable';
import {
  HeaderCellContent,
  type SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';
import {defined} from 'sentry/utils/defined';
import {PanelProvider} from 'sentry/utils/panelProvider';

interface TableProps extends Omit<HTMLAttributes<HTMLTableElement>, 'children'> {
  children?: ReactNode;
  columns?: TableColumnConfig[];
  /** The header row, rendered into the table's `<thead>`. */
  header?: ReactNode;
  ref?: RefObject<HTMLTableElement | null>;
}

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  ref?: RefObject<HTMLTableRowElement | null>;
  variant?: 'default' | 'faded';
}

type HeaderCellVariant = 'default' | 'first' | 'remaining' | 'full-width';

export function SimpleTable({children, columns, header, ...props}: TableProps) {
  return (
    <StyledTable columns={columns} {...props}>
      <PanelProvider>
        {header && <Table.Head>{header}</Table.Head>}
        <Table.Body>{children}</Table.Body>
      </PanelProvider>
    </StyledTable>
  );
}

function HeaderRow({
  children,
  sticky,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & {sticky?: boolean}) {
  return (
    <StyledHeaderRow sticky={sticky} {...props}>
      {children}
    </StyledHeaderRow>
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
}: HTMLAttributes<HTMLTableCellElement> & {
  align?: ColumnAlign;
  children?: React.ReactNode;
  divider?: boolean;
  handleSortClick?: (event: React.MouseEvent) => void;
  sort?: SortDirection;
  to?: LocationDescriptor;
  variant?: HeaderCellVariant;
}) {
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

function RowCell({
  children,
  ...props
}: ComponentProps<typeof Flex> & {
  children: React.ReactNode;
}) {
  return (
    <Flex as="td" role="cell" align="center" overflow="hidden" padding="lg xl" {...props}>
      {children}
    </Flex>
  );
}

const StyledTable = styled(Table)`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  position: relative;
  margin: 0;
  width: 100%;
  overflow: hidden;
`;

const StyledHeaderRow = styled(Table.Row, {
  shouldForwardProp: prop => prop !== 'sticky',
})<{sticky?: boolean}>`
  background: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: calc(${p => p.theme.radius.md} + 1px)
    calc(${p => p.theme.radius.md} + 1px) 0 0;
  text-transform: none;
  justify-content: left;
  padding: 0;
  min-height: 40px;
  align-items: center;

  ${p =>
    p.sticky &&
    css`
      position: sticky;
      top: 0;
      z-index: ${p.theme.zIndex.initial};
    `}
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
  shouldForwardProp: prop => prop !== 'align' && prop !== 'variant',
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
    justify-content: space-between;
    min-width: 0;
  }

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
    p.align === 'right' &&
    css`
      ${HeaderCellContent} {
        justify-content: flex-end;
      }
    `}

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

const Empty = styled(Table.Status)`
  ${emptyCellStyle}
`;

function Loading(props: ComponentProps<typeof Empty>) {
  return (
    <Empty {...props}>
      <LoadingIndicator />
    </Empty>
  );
}

function ErrorState(props: ComponentProps<typeof LoadingError>) {
  return (
    <Empty>
      <LoadingError {...props} />
    </Empty>
  );
}

SimpleTable.HeaderRow = HeaderRow;
SimpleTable.HeaderCell = HeaderCell;
SimpleTable.Row = Row;
SimpleTable.RowCell = RowCell;
SimpleTable.rowLinkStyle = rowLinkStyle;
SimpleTable.Empty = Empty;
SimpleTable.Error = ErrorState;
SimpleTable.Loading = Loading;
SimpleTable.FullWidthCell = FullWidthCell;
SimpleTable.FullWidthRow = FullWidthRow;
