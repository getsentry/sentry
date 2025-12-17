import {useCallback, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import {space} from 'sentry/styles/space';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import type {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {Rect} from 'sentry/utils/profiling/speedscope';

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
  canvas: FlamegraphCanvas
): string {
  // This is because the cursor's origin is in the top left corner of the arrow, so we want
  // to offset it just enough so that the tooltip does not overlap with the arrow's tail.
  // When the tooltip placed to the left of the cursor, we do not have that issue and hence
  // no offset is applied.
  const cursorLeft = cursor[0];
  const cursorTop = cursor[1];

  const canvasBounds = canvas.canvas.getBoundingClientRect();

  let left =
    // Cursor is relative to canvasBounds, not window
    cursorLeft + canvasBounds.left > window.innerWidth / 2
      ? cursorLeft - tooltip.width // place tooltip to the right of cursor
      : cursorLeft + CURSOR_LEFT_OFFSET_PX; // placetooltip on the left of cursor

  if (
    // the tooltip is overflowing on the left
    left + canvasBounds.left < WIDTH_OFFSET ||
    // the tooltip is overflowing on the right
    left + canvasBounds.left + tooltip.width >= window.innerWidth - WIDTH_OFFSET
  ) {
    // align the tooltip to the left edge, this means it's still possible that we
    // overflow on the right in some cases
    left = -canvasBounds.left + WIDTH_OFFSET;
  }

  const top =
    // Cursor is relative to canvasBounds, not window
    cursorTop + canvasBounds.top > window.innerHeight / 2
      ? cursorTop - tooltip.height // place tooltip above cursor
      : cursorTop + CURSOR_TOP_OFFSET_PX; // place tooltip below cursor

  return `translate(${left}px, ${top}px)`;
}

interface BoundTooltipProps {
  canvas: FlamegraphCanvas;
  canvasView: CanvasView<any>;
  cursor: vec2;
  children?: React.ReactNode;
}

const DEFAULT_BOUNDS = Rect.Empty();

function BoundTooltip({
  canvas,
  cursor,
  canvasView,
  children,
}: BoundTooltipProps): React.ReactElement | null {
  const theme = useTheme();
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

  const containerBoundsRef = useRef<Rect>(DEFAULT_BOUNDS);

  if (containerBoundsRef.current.isEmpty()) {
    // using the innerWidth and innerHeight here because we only want the size of the visible portions
    containerBoundsRef.current = new Rect(0, 0, window.innerWidth, window.innerHeight);
  }

  const sizeCache = useRef<{size: DOMRect; value: React.ReactNode} | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const onRef = useCallback(
    (node: any) => {
      if (node === null) {
        return;
      }

      if (rafIdRef.current) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        if (!sizeCache.current || sizeCache.current?.value !== children) {
          sizeCache.current = {value: children, size: node.getBoundingClientRect()};
        }

        node.style.transform = computeBestTooltipPlacement(
          logicalSpaceCursor,
          sizeCache.current.size,
          canvas
        );
      });
    },
    [canvas, logicalSpaceCursor, children]
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
  background: ${p => p.theme.tokens.background.primary};
  position: absolute;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(0.25)} ${space(1)};
  border: 1px solid ${p => p.theme.border};
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 24px;
`;

export {BoundTooltip};
