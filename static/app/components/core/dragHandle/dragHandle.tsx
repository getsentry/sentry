import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import type {CSS} from '@sentry/scraps/cssTypes';
import {Container} from '@sentry/scraps/layout';

import {useDragSeparator} from './useDragSeparator';

export type Orientation = 'horizontal' | 'vertical';

export type DragHandleVariant = 'solid' | 'ghost';

export const DRAG_HANDLE_SIZE = 1;

/** The 24x24 CSS pixel minimum that WCAG 2.5.8 asks of a pointer target. */
export const DRAG_SEPARATOR_TARGET_SIZE = 24;

const targetLength = 'var(--drag-separator-target-length, none)';

const targetOffset = `calc(50% - ${DRAG_SEPARATOR_TARGET_SIZE / 2}px)`;

/**
 * A focusable `separator` is a widget, so it needs a name, or it is announced as a bare
 * value with no subject. Prefer `aria-labelledby` when the handle sits inside an element
 * that is named from its content, such as a table header cell: an `aria-label` there
 * would also become part of that element's own name.
 */
type DragHandleNameProps =
  | {'aria-label': string; 'aria-labelledby'?: never}
  | {'aria-labelledby': string; 'aria-label'?: never};

export type DragHandleProps = DragHandleNameProps & {
  isSizedFirst: boolean;
  max: number;
  min: number;
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  onMove: (delta: number) => void;
  orientation: Orientation;
  value: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  onMoveEnd?: () => void;
  onMoveStart?: () => void;
  variant?: DragHandleVariant;
};

export function DragHandle({
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  variant = 'solid',
  isSizedFirst,
  max,
  min,
  orientation,
  value,
  onDoubleClick,
  onKeyDown,
  onMove,
  onMoveEnd,
  onMoveStart,
}: DragHandleProps) {
  const {cursor, separatorProps} = useDragSeparator({
    isSizedFirst,
    max,
    min,
    onMove,
    onMoveEnd,
    onMoveStart,
    orientation,
    value,
  });

  return (
    <Container position="relative" flexShrink={0}>
      {containerProps => (
        <DragHandleLine
          {...mergeProps(separatorProps, containerProps, {onDoubleClick, onKeyDown})}
          $cursor={cursor}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          data-variant={variant}
        />
      )}
    </Container>
  );
}

const DragHandleLine = styled('div')<{$cursor: CSS['cursor']}>`
  user-select: none;
  touch-action: none;
  pointer-events: none;

  /* Invisible wider hit area for dragging, and the only part that takes pointer events */
  &::before {
    content: '';
    position: absolute;
    z-index: ${p => p.theme.zIndex.drawer};
    pointer-events: auto;
    cursor: ${p => p.$cursor};
  }

  /* Accent bar that lights up on hover/drag */
  &::after {
    content: '';
    position: absolute;
    z-index: ${p => p.theme.zIndex.drawer};
    opacity: 0.8;
    background: transparent;
    transition: background ${p => p.theme.motion.smooth.slow};
  }

  &:hover::after,
  &[data-is-held='true']::after {
    background: ${p => p.theme.tokens.graphics.accent.vibrant};
  }

  &[data-orientation='horizontal'] {
    width: 0;
    height: auto;
    align-self: stretch;
    border-left: 1px solid ${p => p.theme.tokens.border.primary};

    &::before {
      inset: 0 auto 0 ${targetOffset};
      width: ${DRAG_SEPARATOR_TARGET_SIZE}px;
      max-height: ${targetLength};
    }

    &::after {
      inset: 0 auto 0 -2px;
      width: 4px;
    }
  }

  &[data-orientation='vertical'] {
    width: 100%;
    height: 0;
    border-top: 1px solid ${p => p.theme.tokens.border.primary};

    &::before {
      inset: ${targetOffset} 0 auto 0;
      height: ${DRAG_SEPARATOR_TARGET_SIZE}px;
      max-width: ${targetLength};
    }

    &::after {
      inset: -2px 0 auto 0;
      height: 4px;
    }
  }

  &[data-variant='ghost'] {
    border-color: transparent;
    transition: border-color ${p => p.theme.motion.smooth.slow};

    &:hover,
    &:focus-visible,
    &[data-is-held='true'] {
      border-color: ${p => p.theme.tokens.border.primary};
    }
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }
`;
