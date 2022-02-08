import * as React from 'react';
import {mat3, vec2} from 'gl-matrix';

import {getContext, Rect} from 'sentry/utils/profiling/gl/utils';

function measureText(text: string, ctx: CanvasRenderingContext2D): Rect {
  const measures = ctx.measureText(text);

  return new Rect(
    0,
    0,
    measures.width,
    // https://stackoverflow.com/questions/1134586/how-can-you-find-the-height-of-text-on-an-html-canvas
    measures.actualBoundingBoxAscent + measures.actualBoundingBoxDescent
  );
}

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
  children?: React.ReactNode;
}

function BoundTooltip({
  bounds,
  configToPhysicalSpace,
  cursor,
  children,
}: BoundTooltipProps): React.ReactElement | null {
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const tooltipRect = useCachedMeasure(tooltipRef.current?.textContent ?? '');

  const physicalToLogicalSpace = React.useMemo(
    () =>
      mat3.fromScaling(
        mat3.create(),
        vec2.fromValues(1 / window.devicePixelRatio, 1 / window.devicePixelRatio)
      ),
    []
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
  }, [tooltipRef, children, bounds, cursor]);

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
    <div
      ref={tooltipRef}
      style={{
        fontSize: 12,
        fontFamily: `ui-monospace, Menlo, Monaco, 'Cascadia Mono', 'Segoe UI Mono', 'Roboto Mono',
          'Oxygen Mono', 'Ubuntu Monospace', 'Source Code Pro', 'Fira Mono', 'Droid Sans Mono',
          'Courier New', monospace`,
        background: '#fff',
        position: 'absolute',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        left: cursorHorizontalPosition,
        top: cursorVerticalPosition,
        width: Math.min(tooltipRect.width, bounds.width - cursorHorizontalPosition - 2),
      }}
    >
      {children}
    </div>
  ) : null;
}

export {BoundTooltip};
