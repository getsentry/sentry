import type {HTMLAttributes, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {IconArrow} from 'sentry/icons';

export type SortDirection = 'asc' | 'desc';

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
  direction?: SortDirection;
  onSort?: () => void;
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
  align-items: center;
  background: none;
  border: 0;
  cursor: ${p => (p.onClick ? 'pointer' : 'default')};
  display: flex;
  font: inherit;
  gap: ${p => p.theme.space.xs};
  overflow: hidden;
  padding: 0;
  text-align: inherit;
  text-transform: inherit;
`;
