import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {Container} from '@sentry/scraps/layout';

import {useDragMove} from './useDragMove';

export type Orientation = 'horizontal' | 'vertical';

export type DragHandleVariant = 'solid' | 'ghost';

export const DRAG_HANDLE_SIZE = 1;

// At a limit the handle can only travel one way, so point the cursor that way;
// the grow/shrink direction flips when the sized pane sits after the handle.
function getDragHandleCursor(
  orientation: Orientation,
  atMin: boolean,
  atMax: boolean,
  isSizedFirst: boolean
): React.CSSProperties['cursor'] {
  if (orientation === 'horizontal') {
    if (atMin) {
      return isSizedFirst ? 'e-resize' : 'w-resize';
    }
    if (atMax) {
      return isSizedFirst ? 'w-resize' : 'e-resize';
    }
    return 'ew-resize';
  }
  if (atMin) {
    return isSizedFirst ? 's-resize' : 'n-resize';
  }
  if (atMax) {
    return isSizedFirst ? 'n-resize' : 's-resize';
  }
  return 'ns-resize';
}

export type DragHandleProps = {
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
  isSizedFirst,
  max,
  min,
  orientation,
  value,
  variant = 'solid',
  onDoubleClick,
  onKeyDown,
  onMove,
  onMoveEnd,
  onMoveStart,
}: DragHandleProps) {
  const {isHeld, moveProps} = useDragMove({
    onMove,
    onMoveEnd,
    onMoveStart,
    orientation,
  });

  const cursor = getDragHandleCursor(
    orientation,
    value <= min,
    Number.isFinite(max) && value >= max,
    isSizedFirst
  );

  return (
    <Container position="relative" flexShrink={0}>
      {containerProps => (
        <DragHandleLine
          {...mergeProps(moveProps, containerProps, {onDoubleClick, onKeyDown})}
          $cursor={cursor}
          aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuemin={min}
          aria-valuenow={value}
          data-is-held={isHeld}
          data-orientation={orientation}
          data-variant={variant}
          role="separator"
          tabIndex={0}
        />
      )}
    </Container>
  );
}

const DragHandleLine = styled('div')<{$cursor: React.CSSProperties['cursor']}>`
  user-select: none;
  touch-action: none;
  cursor: ${p => p.$cursor};

  /* Invisible wider hit area for dragging */
  &::before {
    content: '';
    position: absolute;
    z-index: ${p => p.theme.zIndex.drawer};
  }

  /* Accent bar that lights up on hover/drag */
  &::after {
    content: '';
    position: absolute;
    z-index: ${p => p.theme.zIndex.drawer};
    opacity: 0.8;
    background: transparent;
    transition: background ${p => p.theme.motion.smooth.slow} 0.1s;
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
      inset: 0 auto 0 -5px;
      width: 11px;
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
      inset: -5px 0 auto 0;
      height: 11px;
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
