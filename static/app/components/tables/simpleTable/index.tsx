import type {ComponentProps, HTMLAttributes, ReactNode, RefObject} from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex} from '@sentry/scraps/layout';

import {
  getAriaSort,
  HeaderCellContent,
  SortableHeaderCell,
  type SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';
import {Table, type TableColumnConfig} from 'sentry/components/tables/table';
import {TableStatusCell} from 'sentry/components/tables/table/styles';
import {defined} from 'sentry/utils/defined';
import {PanelProvider} from 'sentry/utils/panelProvider';

interface TableProps extends Omit<HTMLAttributes<HTMLTableElement>, 'children'> {
  children: ReactNode;
  columns?: TableColumnConfig[];
  ref?: RefObject<HTMLTableElement | null>;
}

interface RowProps extends HTMLAttributes<HTMLTableRowElement> {
  ref?: RefObject<HTMLTableRowElement | null>;
  variant?: 'default' | 'faded';
}

export function SimpleTable({children, columns, ...props}: TableProps) {
  return (
    <StyledTable columns={columns} {...props}>
      <PanelProvider>
        <Table.Body>{children}</Table.Body>
      </PanelProvider>
    </StyledTable>
  );
}

function Header({children, ...props}: HTMLAttributes<HTMLTableRowElement>) {
  return <HeaderRow {...props}>{children}</HeaderRow>;
}

function HeaderCell({
  children,
  sort,
  handleSortClick,
  divider = defined(children) ? true : false,
  ...props
}: HTMLAttributes<HTMLTableCellElement> & {
  children?: React.ReactNode;
  divider?: boolean;
  handleSortClick?: () => void;
  sort?: SortDirection;
}) {
  return (
    <ColumnHeaderCell {...props} aria-sort={getAriaSort(sort)} scope="col">
      <SortableHeaderCell
        direction={sort}
        onSort={handleSortClick}
        overlays={
          <Fragment>
            {divider && <HeaderDivider />}
            {handleSortClick && <InteractionStateLayer />}
          </Fragment>
        }
      >
        {children}
      </SortableHeaderCell>
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

function Empty({children, ...props}: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <Table.Row>
      <StyledEmptyMessage {...props}>{children}</StyledEmptyMessage>
    </Table.Row>
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

const HeaderRow = styled(Table.Row)`
  background: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: calc(${p => p.theme.radius.md} + 1px)
    calc(${p => p.theme.radius.md} + 1px) 0 0;
  text-transform: none;
  justify-content: left;
  padding: 0;
  min-height: 40px;
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

const ColumnHeaderCell = styled(Table.HeadCell)`
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
  padding: 0;
  align-items: stretch;
  flex-direction: column;
`;

const HeaderCellFirst = styled(HeaderCell)`
  grid-column: 1;
`;

const HeaderCellRemaining = styled(HeaderCell)`
  grid-column: 2 / -1;
`;

const FullWidthHeaderCell = styled(HeaderCell)`
  grid-column: 1 / -1;
  padding: 0;
`;

const StyledEmptyMessage = styled(TableStatusCell)`
  min-height: 200px;
  padding: ${p => p.theme.space.xl};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;

SimpleTable.Header = Header;
SimpleTable.HeaderCell = HeaderCell;
SimpleTable.Row = Row;
SimpleTable.RowCell = RowCell;
SimpleTable.rowLinkStyle = rowLinkStyle;
SimpleTable.Empty = Empty;
SimpleTable.FullWidthCell = FullWidthCell;
SimpleTable.FullWidthHeaderCell = FullWidthHeaderCell;
SimpleTable.HeaderCellFirst = HeaderCellFirst;
SimpleTable.HeaderCellRemaining = HeaderCellRemaining;
