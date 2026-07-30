import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

export type Orientation = 'horizontal' | 'vertical';

// The handle renders as a 1px border; account for it when a consumer derives
// layout sizes (e.g. the max size of a panel next to it).
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
  isHeld: boolean;
  isSizedFirst: boolean;
  max: number;
  min: number;
  onDoubleClick: React.MouseEventHandler<HTMLElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  orientation: Orientation;
  value: number;
};

export function DragHandle({
  isHeld,
  isSizedFirst,
  max,
  min,
  orientation,
  value,
  onDoubleClick,
  onKeyDown,
  onPointerDown,
}: DragHandleProps) {
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
          {...containerProps}
          $cursor={cursor}
          aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuemin={min}
          aria-valuenow={value}
          data-is-held={isHeld}
          data-orientation={orientation}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
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

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
  }
`;
