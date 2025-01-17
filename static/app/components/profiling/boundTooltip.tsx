import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import {space} from 'sentry/styles/space';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {Rect} from 'sentry/utils/profiling/speedscope';
import theme from 'sentry/utils/theme';

// The cursor icon is drawn with an origin in the top left, which means that if we render
// a tooltip directly at the cursor's position, it will overlap with the cursor icon.
//          x      <- client x
//          |----| <- cursor icon
//          |-------------| <- tooltip
//
// This wont happen if we draw the tooltip to the left of the cursor, as the cursor icon will
// be drawn to right of the tooltip. The offset helps us correct this and remove the overlap.
//               x      <- client x offset
//               |----| <- cursor icon
// |-------------|      <- tooltip

// We only need to do this when drawing the tooltip on the left side of the cursor, as
// the origin is in the correct position when drawing the tooltip on the right side.
const CURSOR_LEFT_OFFSET_PX = 6;
const CURSOR_TOP_OFFSET_PX = 4;
// Gap between the tooltip and container edge for each side
const WIDTH_OFFSET = 8;

function computeBestTooltipPlacement(
  cursor: vec2,
  tooltip: DOMRect,
  canvas: Rect,
  container: Rect
): string {
  // This is because the cursor's origin is in the top left corner of the arrow, so we want
  // to offset it just enough so that the tooltip does not overlap with the arrow's tail.
  // When the tooltip placed to the left of the cursor, we do not have that issue and hence
  // no offset is applied.
  const cursorLeft = cursor[0];
  const cursorTop = cursor[1];

  // Cursor is relative to canvas, not container
  const cursorRelativeToContainer = cursorLeft + canvas.x;

  let left =
    cursorRelativeToContainer > container.width / 2
      ? cursorLeft - tooltip.width
      : cursorLeft + CURSOR_LEFT_OFFSET_PX;

  const right = left + tooltip.width + canvas.left;

  if (left + canvas.left - WIDTH_OFFSET <= 0) {
    left = -canvas.left + WIDTH_OFFSET;
  } else if (right >= container.width - WIDTH_OFFSET) {
    left = container.width - tooltip.width - canvas.left - WIDTH_OFFSET;
  }

  return `translate(${left}px, ${cursorTop + CURSOR_TOP_OFFSET_PX}px)`;
}

interface BoundTooltipProps {
  canvas: FlamegraphCanvas;
  canvasBounds: Rect;
  canvasView: CanvasView<any>;
  cursor: vec2;
  children?: React.ReactNode;
  containerBounds?: Rect;
}

const DEFAULT_BOUNDS = Rect.Empty();

function BoundTooltip({
  containerBounds,
  canvasBounds,
  canvas,
  cursor,
  canvasView,
  children,
}: BoundTooltipProps): React.ReactElement | null {
  const flamegraphTheme = useFlamegraphTheme();

  const physicalSpaceCursor = vec2.transformMat3(
    vec2.create(),
    cursor,
    canvasView.fromTransformedConfigView(canvas.physicalSpace)
  );

  const logicalSpaceCursor = vec2.transformMat3(
    vec2.create(),
    physicalSpaceCursor,
    canvas.physicalToLogicalSpace
  );

  const containerBoundsRef = useRef<Rect>(containerBounds ?? DEFAULT_BOUNDS);

  if (containerBounds) {
    containerBoundsRef.current = containerBounds;
  } else if (containerBoundsRef.current.isEmpty()) {
    const bodyRect = document.body.getBoundingClientRect();
    containerBoundsRef.current = new Rect(
      bodyRect.x,
      bodyRect.y,
      bodyRect.width,
      bodyRect.height
    );
  }

  const sizeCache = useRef<{size: DOMRect; value: React.ReactNode} | null>(null);
  const rafIdRef = useRef<number | undefined>();
  const onRef = useCallback(
    (node: any) => {
      if (node === null) {
        return;
      }

      if (rafIdRef.current) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = undefined;
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (!sizeCache.current || sizeCache.current?.value !== children) {
          sizeCache.current = {value: children, size: node.getBoundingClientRect()};
        }

        node.style.transform = computeBestTooltipPlacement(
          logicalSpaceCursor,
          sizeCache.current.size,
          canvasBounds,
          containerBoundsRef.current
        );
      });
    },
    [canvasBounds, logicalSpaceCursor, children]
  );

  return (
    <Tooltip
      ref={onRef}
      style={{
        willChange: 'transform',
        fontSize: flamegraphTheme.SIZES.TOOLTIP_FONT_SIZE,
        fontFamily: flamegraphTheme.FONTS.FONT,
        zIndex: theme.zIndex.tooltip,
        maxWidth: containerBoundsRef.current.width - 2 * WIDTH_OFFSET,
      }}
    >
      {children}
    </Tooltip>
  );
}

const Tooltip = styled('div')`
  background: ${p => p.theme.background};
  position: absolute;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.25)} ${space(1)};
  border: 1px solid ${p => p.theme.border};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 24px;
`;

export {BoundTooltip};
