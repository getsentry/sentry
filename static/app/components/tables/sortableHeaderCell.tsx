import type {HTMLAttributes, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {IconArrow} from 'sentry/icons';

export type SortDirection = 'asc' | 'desc';

/**
 * `aria-sort` has to sit on the element carrying the `columnheader` role, which
 * is each table shell's own head cell rather than this component.
 */
export function getAriaSort(
  direction: SortDirection | undefined
): 'ascending' | 'descending' | undefined {
  switch (direction) {
    case 'asc':
      return 'ascending';
    case 'desc':
      return 'descending';
    default:
      return undefined;
  }
}

interface SortableHeaderCellProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /**
   * Omit when this column is not the active sort.
   */
  direction?: SortDirection;
  /**
   * Omit to render a non-interactive cell.
   */
  onSort?: () => void;
  /**
   * Rendered before the label. Absolutely positioned decoration belongs here
   * rather than in `children`, which is clipped for truncation.
   */
  overlays?: ReactNode;
}

export function SortableHeaderCell({
  children,
  direction,
  onSort,
  overlays,
  ...props
}: SortableHeaderCellProps) {
  return (
    <HeaderCellContent
      {...props}
      as={onSort ? 'button' : 'div'}
      onClick={onSort}
      type={onSort ? 'button' : undefined}
    >
      {overlays}
      <Tooltip showOnlyOnOverflow skipWrapper title={children}>
        <Label>{children}</Label>
      </Tooltip>
      {direction && (
        <IconArrow
          aria-hidden
          direction={direction === 'desc' ? 'down' : 'up'}
          size="xs"
        />
      )}
    </HeaderCellContent>
  );
}

const Label = styled('div')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HeaderCellContent = styled('div')<{type?: 'button'}>`
  background: none;
  border: 0;
  font: inherit;
  padding: 0;
  text-align: inherit;
  text-transform: inherit;

  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  cursor: ${p => (p.onClick ? 'pointer' : 'default')};
  overflow: hidden;
`;
