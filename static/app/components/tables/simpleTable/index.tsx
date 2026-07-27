import type {ComponentProps, HTMLAttributes, RefObject} from 'react';
import {Fragment} from 'react';
import {css} from '@emotion/react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {
  getAriaSort,
  SortableHeaderCell,
  type SortDirection,
} from 'sentry/components/tables/sortableHeaderCell';
import {defined} from 'sentry/utils/defined';

interface TableProps extends HTMLAttributes<HTMLDivElement> {
  ref?: RefObject<HTMLDivElement | null>;
}

interface RowProps extends HTMLAttributes<HTMLDivElement> {
  ref?: RefObject<HTMLDivElement | null>;
  variant?: 'default' | 'faded';
}

export function SimpleTable({children, ...props}: TableProps) {
  return (
    <StyledPanel {...props} role="table">
      {children}
    </StyledPanel>
  );
}

function Header({children, ...props}: HTMLAttributes<HTMLDivElement>) {
  return (
    <StyledPanelHeader {...props} role="row">
      {children}
    </StyledPanelHeader>
  );
}

function HeaderCell({
  children,
  sort,
  handleSortClick,
  divider = defined(children) ? true : false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
  divider?: boolean;
  handleSortClick?: () => void;
  sort?: SortDirection;
}) {
  return (
    <ColumnHeaderCell
      {...props}
      aria-sort={getAriaSort(sort)}
      direction={sort}
      onSort={handleSortClick}
      overlays={
        <Fragment>
          {divider && <HeaderDivider />}
          {handleSortClick && <InteractionStateLayer />}
        </Fragment>
      }
      role="columnheader"
    >
      {children}
    </ColumnHeaderCell>
  );
}

function Row({children, variant = 'default', ref, ...props}: RowProps) {
  return (
    <StyledRow variant={variant} role="row" ref={ref} {...props}>
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
    <Flex role="cell" align="center" overflow="hidden" padding="lg xl" {...props}>
      {children}
    </Flex>
  );
}

const StyledPanel = styled(Panel)`
  display: grid;
  margin: 0;
  width: 100%;
  overflow: hidden;
`;

const StyledPanelHeader = styled('div')`
  background: ${p => p.theme.tokens.background.secondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: calc(${p => p.theme.radius.md} + 1px)
    calc(${p => p.theme.radius.md} + 1px) 0 0;
  justify-content: left;
  padding: 0;
  min-height: 40px;
  align-items: center;
  text-transform: none;
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
`;

const StyledRow = styled('div', {
  shouldForwardProp: prop => prop !== 'variant',
})<{variant?: 'default' | 'faded'}>`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  position: relative;
  align-items: center;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }

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

const ColumnHeaderCell = styled(SortableHeaderCell)`
  outline: none;
  padding: 0 ${p => p.theme.space.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};

  position: relative;
  justify-content: space-between;
  height: 100%;

  &:focus-visible {
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

const StyledEmptyMessage = styled('div')`
  grid-column: 1 / -1;
  min-height: 200px;
  padding: ${p => p.theme.space.xl};
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;

SimpleTable.Header = Header;
SimpleTable.HeaderCell = HeaderCell;
SimpleTable.Row = Row;
SimpleTable.RowCell = RowCell;
SimpleTable.rowLinkStyle = rowLinkStyle;
SimpleTable.Empty = StyledEmptyMessage;
