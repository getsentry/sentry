import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import space from 'sentry/styles/space';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {getContext, measureText, Rect} from 'sentry/utils/profiling/gl/utils';

const useCachedMeasure = (string: string, font: string): Rect => {
  const cache = useRef<Record<string, Rect>>({});
  const ctx = useMemo(() => {
    const context = getContext(document.createElement('canvas'), '2d');
    context.font = font;
    return context;
  }, [font]);

  return useMemo(() => {
    if (cache.current[string]) {
      return cache.current[string];
    }

    if (!ctx) {
      return Rect.Empty();
    }

    const measures = measureText(string, ctx);
    cache.current[string] = measures;

    return new Rect(0, 0, measures.width, measures.height);
  }, [string, ctx]);
};

interface BoundTooltipProps {
  bounds: Rect;
  cursor: vec2 | null;
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
  const tooltipRect = useCachedMeasure(
    tooltipRef.current?.textContent ?? '',
    `${flamegraphTheme.SIZES.TOOLTIP_FONT_SIZE}px ${flamegraphTheme.FONTS.FONT}`
  );
  const [tooltipBounds, setTooltipBounds] = useState<Rect>(Rect.Empty());

  useLayoutEffect(() => {
    if (!children || bounds.isEmpty() || !tooltipRef.current) {
      setTooltipBounds(Rect.Empty());
      return;
    }

    const newTooltipBounds = tooltipRef.current.getBoundingClientRect();

    setTooltipBounds(
      new Rect(
        newTooltipBounds.x,
        newTooltipBounds.y,
        newTooltipBounds.width,
        newTooltipBounds.height
      )
    );
  }, [children, bounds, cursor]);

  if (!children || !cursor || bounds.isEmpty()) {
    return null;
  }

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

  let cursorHorizontalPosition = logicalSpaceCursor[0];
  // Move the tooltip just beneath the cursor so that the text isn't covered.
  const cursorVerticalPosition = logicalSpaceCursor[1] + 8;
  const mid = bounds.width / 2;

  // If users screen is on right half of the screen, then we have more space to position on the left and vice versa
  // since default is right, we only need to handle 1 case
  if (cursorHorizontalPosition > mid) {
    // console.log('Cursor over mid');
    cursorHorizontalPosition -= tooltipBounds.width;
  }

  const PADDING = 24;
  return (
    <Tooltip
      ref={tooltipRef}
      style={{
        fontSize: flamegraphTheme.SIZES.TOOLTIP_FONT_SIZE,
        fontFamily: flamegraphTheme.FONTS.FONT,
        left: cursorHorizontalPosition,
        top: cursorVerticalPosition,
        width:
          Math.min(tooltipRect.width, bounds.width - cursorHorizontalPosition - 2) +
          PADDING,
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
`;

export {BoundTooltip};
