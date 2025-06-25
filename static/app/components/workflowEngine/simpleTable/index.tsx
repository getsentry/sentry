import type {CSSProperties, HTMLAttributes} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout/flex';
import Panel from 'sentry/components/panels/panel';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Sort} from 'sentry/utils/discover/fields';

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
  name,
  sortKey,
  sort,
  handleSortClick,
}: {
  name: string;
  children?: React.ReactNode;
  handleSortClick?: () => void;
  sort?: Sort;
  sortKey?: string;
}) {
  const isSortedByField = sort?.field === sortKey;

  return (
    <ColumnHeaderCell
      className={name}
      isSorted={isSortedByField}
      onClick={handleSortClick}
      role="columnheader"
      as={sortKey ? 'button' : 'div'}
    >
      {children && <HeaderDivider />}
      {sortKey && <InteractionStateLayer />}
      <HeadingText>{children}</HeadingText>
      {sortKey && (
        <SortIndicator
          aria-hidden
          size="xs"
          direction={sort?.kind === 'asc' ? 'up' : 'down'}
          isSorted={isSortedByField}
        />
      )}
    </ColumnHeaderCell>
  );
}

function Row({children, variant = 'default', ...props}: RowProps) {
  return (
    <StyledRow variant={variant} role="row" {...props}>
      <InteractionStateLayer />
      {children}
    </StyledRow>
  );
}

function RowCell({
  children,
  name,
  justify,
}: {
  children: React.ReactNode;
  name: string;
  justify?: CSSProperties['justifyContent'];
}) {
  return (
    <StyledRowCell className={name} role="cell" align="center" justify={justify}>
      {children}
    </StyledRowCell>
  );
}

const StyledPanel = styled(Panel)`
  display: grid;
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
  font-weight: ${p => p.theme.fontWeightBold};
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
