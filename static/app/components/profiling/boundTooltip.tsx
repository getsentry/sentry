import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import {space} from 'sentry/styles/space';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {Rect} from 'sentry/utils/profiling/speedscope';
import theme from 'sentry/utils/theme';

function computeBestTooltipPlacement(
  cursor: vec2,
  container: Rect,
  tooltip: DOMRect
): string {
  // This is because the cursor's origin is in the top left corner of the arrow, so we want
  // to offset it just enough so that the tooltip does not overlap with the arrow's tail.
  // When the tooltip placed to the left of the cursor, we do not have that issue and hence
  // no offset is applied.
  const OFFSET_PX = 6;
  let left = cursor[0] + OFFSET_PX;
  const top = cursor[1] + OFFSET_PX;

  if (cursor[0] > container.width / 2) {
    left = cursor[0] - tooltip.width; // No offset is applied here as tooltip is placed to the left
  }

  return `translate(${left || 0}px, ${top || 0}px)`;
}

interface BoundTooltipProps {
  bounds: Rect;
  canvas: FlamegraphCanvas;
  canvasView: CanvasView<any>;
  cursor: vec2;
  children?: React.ReactNode;
}

function BoundTooltip({
  bounds,
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

  const rafIdRef = useRef<number | undefined>();
  const onRef = useCallback(
    node => {
      if (node === null) {
        return;
      }

      if (rafIdRef.current) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = undefined;
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        node.style.transform = computeBestTooltipPlacement(
          logicalSpaceCursor,
          bounds,
          node.getBoundingClientRect()
        );
      });
    },
    [bounds, logicalSpaceCursor]
  );

  return (
    <Tooltip
      ref={onRef}
      style={{
        willChange: 'transform',
        fontSize: flamegraphTheme.SIZES.TOOLTIP_FONT_SIZE,
        fontFamily: flamegraphTheme.FONTS.FONT,
        zIndex: theme.zIndex.tooltip,
        maxWidth: bounds.width,
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
