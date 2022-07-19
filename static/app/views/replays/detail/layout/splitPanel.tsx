import {DOMAttributes, ReactNode, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import space from 'sentry/styles/space';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';

const BAR_THICKNESS = 16;
const HALF_BAR = BAR_THICKNESS / 2;

const MOUSE_RELEASE_TIMEOUT_MS = 200;

type CSSValue = `${number}px` | `${number}%`;
type LimitValue =
  | {
      /**
       * Percent, as a value from `0` to `1.0`
       */
      pct: number;
    }
  | {
      /**
       * CSS pixels
       */
      px: number;
    };

type Side =
  | ReactNode
  | {
      content: ReactNode;
      default?: CSSValue;
      max?: LimitValue;
      min?: LimitValue;
    };

type Props =
  | {
      /**
       * Content on the right side of the split
       */
      left: Side;
      /**
       * Content on the left side of the split
       */
      right: Side;
    }
  | {
      /**
       * Content below the split
       */
      bottom: Side;
      /**
       * Content above of the split
       */
      top: Side;
    };

const getValFromSide = (side: Side, field: string) =>
  side && typeof side === 'object' && field in side ? side[field] : undefined;

function getSplitDefault(props: Props) {
  if ('left' in props) {
    const a = getValFromSide(props.left, 'default');
    if (a) {
      return {a};
    }
    const b = getValFromSide(props.right, 'default');
    if (b) {
      return {b};
    }
    return {a: '50%'};
  }
  const a = getValFromSide(props.top, 'default');
  if (a) {
    return {a};
  }
  const b = getValFromSide(props.bottom, 'default');
  if (b) {
    return {b};
  }
  return {a: '50%'};
}

function getMinMax(side: Side): {
  max: {pct: number; px: number};
  min: {pct: number; px: number};
} {
  const ONE = {px: Number.MAX_SAFE_INTEGER, pct: 1.0};
  const ZERO = {px: 0, pct: 0};
  if (!side || typeof side !== 'object') {
    return {
      max: ONE,
      min: ZERO,
    };
  }
  return {
    max: 'max' in side ? {...ONE, ...side.max} : ONE,
    min: 'min' in side ? {...ZERO, ...side.min} : ZERO,
  };
}

function useTimeout({timeMs, callback}: {callback: () => void; timeMs: number}) {
  const timeoutRef = useRef<number>(null);

  const saveTimeout = useCallback((timeout: ReturnType<typeof setTimeout> | null) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // See: https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
    // @ts-expect-error
    timeoutRef.current = timeout;
  }, []);

  return {
    start: () => saveTimeout(setTimeout(callback, timeMs)),
    stop: () => saveTimeout(null),
  };
}

function SplitPanel(props: Props) {
  const [mousedown, setMousedown] = useState(false);
  const [sizeCSS, setSizeCSS] = useState(getSplitDefault(props));
  const {start: startMouseIdleTimer, stop: stopMouseIdleTimer} = useTimeout({
    timeMs: MOUSE_RELEASE_TIMEOUT_MS,
    callback: () => setMousedown(false),
  });

  const handleMouseDown = useCallback(() => {
    setMousedown(true);

    document.addEventListener(
      'mouseup',
      () => {
        setMousedown(false);
        stopMouseIdleTimer();
      },
      {once: true}
    );

    startMouseIdleTimer();
  }, [startMouseIdleTimer, stopMouseIdleTimer]);

  const handlePositionChange = useCallback(
    params => {
      if (mousedown && params) {
        startMouseIdleTimer();
        const {left, top, width, height} = params;

        if ('left' in props) {
          const priPx = left - HALF_BAR;
          const priPct = priPx / width;
          const secPx = width - priPx;
          const secPct = 1 - priPct;
          const priLim = getMinMax(props.left);
          const secLim = getMinMax(props.right);
          if (
            priPx < priLim.min.px ||
            priPx > priLim.max.px ||
            priPct < priLim.min.pct ||
            priPct > priLim.max.pct ||
            secPx < secLim.min.px ||
            secPx > secLim.max.px ||
            secPct < secLim.min.pct ||
            secPct > secLim.max.pct
          ) {
            return;
          }
          setSizeCSS({a: `${priPct * 100}%`});
        } else {
          const priPx = top - HALF_BAR;
          const priPct = priPx / height;
          const secPx = height - priPx;
          const secPct = 1 - priPct;
          const priLim = getMinMax(props.top);
          const secLim = getMinMax(props.bottom);
          if (
            priPx < priLim.min.px ||
            priPx > priLim.max.px ||
            priPct < priLim.min.pct ||
            priPct > priLim.max.pct ||
            secPx < secLim.min.px ||
            secPx > secLim.max.px ||
            secPct < secLim.min.pct ||
            secPct > secLim.max.pct
          ) {
            return;
          }
          setSizeCSS({a: `${priPct * 100}%`});
        }
      }
    },
    [mousedown, props, startMouseIdleTimer]
  );

  const mouseTrackingProps = useMouseTracking<HTMLDivElement>({
    onPositionChange: handlePositionChange,
  });

  if ('left' in props) {
    const {left: a, right: b} = props;

    return (
      <SplitPanelContainer orientation="columns" size={sizeCSS} {...mouseTrackingProps}>
        <Panel>{getValFromSide(a, 'content') || a}</Panel>
        <Divider
          slideDirection="leftright"
          mousedown={mousedown}
          onMouseDown={handleMouseDown}
        />
        <Panel>{getValFromSide(b, 'content') || b}</Panel>
      </SplitPanelContainer>
    );
  }
  const {top: a, bottom: b} = props;
  return (
    <SplitPanelContainer orientation="rows" size={sizeCSS} {...mouseTrackingProps}>
      <Panel>{getValFromSide(a, 'content') || a}</Panel>
      <Divider
        slideDirection="updown"
        onMouseDown={() => setMousedown(true)}
        onMouseUp={() => setMousedown(false)}
        mousedown={mousedown}
      />
      <Panel>{getValFromSide(b, 'content') || b}</Panel>
    </SplitPanelContainer>
  );
}

const SplitPanelContainer = styled('div')<{
  orientation: 'rows' | 'columns';
  size: {a: CSSValue} | {b: CSSValue};
}>`
  width: 100%;
  height: 100%;

  display: grid;
  overflow: auto;
  grid-template-${p => p.orientation}:
    ${p => ('a' in p.size ? p.size.a : '1fr')}
    auto
    ${p => ('a' in p.size ? '1fr' : p.size.b)};
`;

const Panel = styled('div')`
  overflow: hidden;
`;

type DividerProps = {mousedown: boolean; slideDirection: 'leftright' | 'updown'};
const Divider = styled(
  ({
    mousedown: _a,
    slideDirection: _b,
    ...props
  }: DividerProps & DOMAttributes<HTMLDivElement>) => (
    <div {...props}>
      <IconGrabbable size="sm" />
    </div>
  )
)<DividerProps>`
  display: grid;
  place-items: center;
  height: 100%;
  width: 100%;

  ${p => (p.mousedown ? 'user-select: none;' : '')}

  :hover {
    background: ${p => p.theme.hover};
  }

  ${p =>
    p.slideDirection === 'leftright'
      ? `
        cursor: ew-resize;
        height: 100%;
        width: ${space(2)};
      `
      : `
        cursor: ns-resize;
        width: 100%;
        height: ${space(2)};

        & > svg {
          transform: rotate(90deg);
        }
      `}
`;

export default SplitPanel;
