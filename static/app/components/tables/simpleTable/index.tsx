import type {ComponentProps, CSSProperties, HTMLAttributes} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout/flex';
import Panel from 'sentry/components/panels/panel';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface RowProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'faded';
}

export function SimpleTable({className, children}: TableProps) {
  return (
    <StyledPanel className={className} role="table">
      {children}
    </StyledPanel>
  );
}

function Header({children}: {children: React.ReactNode}) {
  return <StyledPanelHeader role="row">{children}</StyledPanelHeader>;
}

function HeaderCell({
  children,
  sort,
  handleSortClick,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
  handleSortClick?: () => void;
  sort?: 'asc' | 'desc';
}) {
  const isSorted = sort !== undefined;
  const canSort = handleSortClick !== undefined;

  return (
    <ColumnHeaderCell
      {...props}
      isSorted={isSorted}
      onClick={handleSortClick}
      role="columnheader"
      as={canSort ? 'button' : 'div'}
    >
      {children && <HeaderDivider />}
      {canSort && <InteractionStateLayer />}
      <HeadingText>{children}</HeadingText>
      {isSorted && (
        <SortIndicator
          aria-hidden
          size="xs"
          direction={sort === 'asc' ? 'up' : 'down'}
          isSorted={isSorted}
        />
      )}
    </ColumnHeaderCell>
  );
}

function Row({children, variant = 'default', ...props}: RowProps) {
  return (
    <StyledRow variant={variant} role="row" {...props}>
      {children}
    </StyledRow>
  );
}

function RowCell({
  children,
  className,
  justify,
  ...props
}: ComponentProps<typeof Flex> & {
  children: React.ReactNode;
  className?: string;
  justify?: CSSProperties['justifyContent'];
}) {
  return (
    <StyledRowCell
      {...props}
      className={className}
      role="cell"
      align="center"
      justify={justify}
    >
      {children}
    </StyledRowCell>
  );
}

const StyledPanel = styled(Panel)`
  display: grid;
  margin: 0;
`;

const StyledPanelHeader = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  border-radius: calc(${p => p.theme.borderRadius} + 1px)
    calc(${p => p.theme.borderRadius} + 1px) 0 0;
  justify-content: left;
  padding: 0;
  min-height: 40px;
  align-items: center;
  text-transform: none;
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
`;

const StyledRowCell = styled(Flex)`
  overflow: hidden;
  padding: ${space(2)};
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
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  ${p =>
    p.variant === 'faded' &&
    css`
      ${StyledRowCell}, {
        opacity: 0.8;
      }
    `}
`;

const HeadingText = styled('div')`
  display: flex;
  align-items: center;
`;

const HeaderDivider = styled('div')`
  position: absolute;
  left: 0;
  background-color: ${p => p.theme.gray200};
  width: 1px;
  border-radius: ${p => p.theme.borderRadius};
  height: 14px;
`;

const ColumnHeaderCell = styled('div')<{isSorted?: boolean}>`
  background: none;
  outline: none;
  border: none;
  padding: 0 ${space(2)};
  text-transform: inherit;
  font-weight: ${p => p.theme.fontWeight.bold};
  text-align: left;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};

  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
  height: 100%;

  &:first-child {
    ${HeaderDivider} {
      display: none;
    }
  }

  ${p =>
    p.isSorted &&
    css`
      color: ${p.theme.textColor};
    `}
`;

const SortIndicator = styled(IconArrow, {
  shouldForwardProp: prop => prop !== 'isSorted',
})<{isSorted?: boolean}>`
  visibility: hidden;

  ${p =>
    p.isSorted &&
    css`
      visibility: visible;
    `}
`;

const StyledEmptyMessage = styled('div')`
  grid-column: 1 / -1;
  min-height: 200px;
  padding: ${space(2)};
  display: flex;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
`;

SimpleTable.Header = Header;
SimpleTable.HeaderCell = HeaderCell;
SimpleTable.Row = Row;
SimpleTable.RowCell = RowCell;
SimpleTable.Empty = StyledEmptyMessage;
