import type {HTMLAttributes, MouseEvent, ReactNode} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Link} from '@sentry/scraps/link';
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

export type ColumnAlign = 'left' | 'right';

interface SortableHeaderCellProps extends HTMLAttributes<HTMLDivElement> {
  align?: ColumnAlign;
  children?: ReactNode;
  direction?: SortDirection;
  onSort?: (event: MouseEvent) => void;
  overlays?: ReactNode;
  /**
   * Whether `to` should replace the history entry rather than pushing a new one.
   */
  replace?: boolean;
  /**
   * Sort destination to navigate to on sort.
   */
  to?: LocationDescriptor;
}

export function SortableHeaderCell({
  align,
  children,
  direction,
  onSort,
  overlays,
  replace,
  to,
  ...props
}: SortableHeaderCellProps) {
  return (
    <HeaderCellContent
      {...props}
      align={align}
      as={to ? Link : onSort ? 'button' : 'div'}
      onClick={onSort}
      replace={to ? replace : undefined}
      to={to}
      type={!to && onSort ? 'button' : undefined}
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

export const HeaderCellContent = styled('div', {
  shouldForwardProp: prop =>
    prop !== 'align' && (prop === 'to' || prop === 'replace' || isPropValid(prop)),
})<{
  align?: ColumnAlign;
  replace?: boolean;
  to?: LocationDescriptor;
  type?: 'button';
}>`
  align-items: center;
  background: none;
  border: 0;
  color: inherit;
  cursor: ${p => (p.onClick || p.to ? 'pointer' : 'default')};
  display: flex;
  flex: 1;
  font: inherit;
  gap: ${p => p.theme.space.xs};
  min-width: 0;
  overflow: hidden;
  padding: 0;
  text-align: inherit;
  text-transform: inherit;

  ${p => p.align === 'right' && 'justify-content: flex-end;'}

  &:hover,
  &:active,
  &:focus,
  &:visited {
    color: inherit;
  }
`;
