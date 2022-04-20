import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {getContext, measureText, Rect} from 'sentry/utils/profiling/gl/utils';
import {useDevicePixelRatio} from 'sentry/utils/useDevicePixelRatio';

const useCachedMeasure = (string: string, font: string): Rect => {
  const cache = useRef<Record<string, Rect>>({});
  const ctx = useMemo(() => {
    const context = getContext(document.createElement('canvas'), '2d');
    context.font = font;
    return context;
  }, []);

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
  configViewToPhysicalSpace: mat3;
  cursor: vec2 | null;
  children?: React.ReactNode;
}

function BoundTooltip({
  bounds,
  configViewToPhysicalSpace,
  cursor,
  children,
}: BoundTooltipProps): React.ReactElement | null {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const flamegraphTheme = useFlamegraphTheme();
  const tooltipRect = useCachedMeasure(
    tooltipRef.current?.textContent ?? '',
    `${flamegraphTheme.SIZES.TOOLTIP_FONT_SIZE}px ${flamegraphTheme.FONTS.FONT}`
  );
  const devicePixelRatio = useDevicePixelRatio();

  const physicalToLogicalSpace = useMemo(
    () =>
      mat3.fromScaling(
        mat3.create(),
        vec2.fromValues(1 / devicePixelRatio, 1 / devicePixelRatio)
      ),
    [devicePixelRatio]
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
    vec2.fromValues(cursor[0], cursor[1]),

    configViewToPhysicalSpace
  );

  const logicalSpaceCursor = vec2.transformMat3(
    vec2.create(),
    physicalSpaceCursor,
    physicalToLogicalSpace
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

  return children ? (
    <Tooltip
      ref={tooltipRef}
      style={{
        fontSize: flamegraphTheme.SIZES.TOOLTIP_FONT_SIZE,
        fontFamily: flamegraphTheme.FONTS.FONT,
        left: cursorHorizontalPosition,
        top: cursorVerticalPosition,
        width: Math.min(tooltipRect.width, bounds.width - cursorHorizontalPosition - 2),
      }}
    >
      {children}
    </Tooltip>
  ) : null;
}

const Tooltip = styled('div')`
  background: ${p => p.theme.background};
  position: absolute;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
`;

export {BoundTooltip};
