import * as React from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import {getContext, measureText, Rect} from 'sentry/utils/profiling/gl/utils';

const useCachedMeasure = (string: string): Rect => {
  const cache = React.useRef<Record<string, Rect>>({});
  const ctx = React.useMemo(() => {
    const context = getContext(document.createElement('canvas'), '2d');

    context.font = `12px ui-monospace, Menlo, Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono',
    'Oxygen Mono', 'Ubuntu Monospace', 'Source Code Pro', 'Fira Mono', 'Droid Sans Mono',
    'Courier New', monospace`;
    return context;
  }, []);

  return React.useMemo(() => {
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
  configToPhysicalSpace: mat3;
  cursor: vec2 | null;
  theme: FlamegraphTheme;
  children?: React.ReactNode;
}

function BoundTooltip({
  bounds,
  configToPhysicalSpace,
  cursor,
  children,
  theme,
}: BoundTooltipProps): React.ReactElement | null {
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const tooltipRect = useCachedMeasure(tooltipRef.current?.textContent ?? '');

  const physicalToLogicalSpace = React.useMemo(
    () =>
      mat3.fromScaling(
        mat3.create(),
        vec2.fromValues(1 / window.devicePixelRatio, 1 / window.devicePixelRatio)
      ),
    [window.devicePixelRatio]
  );

  const [tooltipBounds, setTooltipBounds] = React.useState<Rect>(Rect.Empty());

  React.useLayoutEffect(() => {
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

    configToPhysicalSpace
  );

  const logicalSpaceCursor = vec2.transformMat3(
    vec2.create(),
    physicalSpaceCursor,
    physicalToLogicalSpace
  );

  let cursorHorizontalPosition = logicalSpaceCursor[0];
  const cursorVerticalPosition = logicalSpaceCursor[1];

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
        fontSize: theme.SIZES.TOOLTIP_FONT_SIZE,
        fontFamily: theme.FONTS.FONT,
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
  background: #fff;
  position: absolute;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
`;

export {BoundTooltip};
