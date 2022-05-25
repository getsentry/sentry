import {useRef} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import space from 'sentry/styles/space';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import theme from 'sentry/utils/theme';

function computeBestTooltipPlacement(cursor: vec2, container: Rect) {
  // This is because the cursor's origin is in the top left corner of the arrow, so we want
  // to offset it just enough so that the tooltip does not overlap with the arrow's tail.
  // When the tooltip placed to the left of the cursor, we do not have that issue and hence
  // no offset is applied.
  const OFFSET_PX = 6;

  const style: Record<string, number | undefined> = {
    left: cursor[0] + OFFSET_PX,
    right: undefined,
    top: cursor[1] + OFFSET_PX,
    bottom: undefined,
  };

  if (cursor[0] > container.width / 2) {
    style.left = undefined;
    style.right = container.width - cursor[0]; // No offset is applied here as tooltip is placed to the left
  }

  return style;
}

interface BoundTooltipProps {
  bounds: Rect;
  cursor: vec2;
  flamegraphCanvas: FlamegraphCanvas;
  flamegraphView: FlamegraphView;
  children?: React.ReactNode;
}

function BoundTooltip({
  bounds,
  flamegraphCanvas,
  cursor,
  flamegraphView,
  children,
}: BoundTooltipProps): React.ReactElement | null {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const flamegraphTheme = useFlamegraphTheme();

  const physicalSpaceCursor = vec2.transformMat3(
    vec2.create(),
    cursor,
    flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace)
  );

  const logicalSpaceCursor = vec2.transformMat3(
    vec2.create(),
    physicalSpaceCursor,
    flamegraphCanvas.physicalToLogicalSpace
  );

  const placement = computeBestTooltipPlacement(logicalSpaceCursor, bounds);

  return (
    <Tooltip
      ref={tooltipRef}
      style={{
        ...placement,
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
`;

export {BoundTooltip};
