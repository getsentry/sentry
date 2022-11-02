import {DOMAttributes, ReactNode, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import space from 'sentry/styles/space';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';
import useSplitPanelTracking from 'sentry/utils/replays/hooks/useSplitPanelTracking';
import useTimeout from 'sentry/utils/useTimeout';

const BAR_THICKNESS = 16;
const HALF_BAR = BAR_THICKNESS / 2;

const MOUSE_RELEASE_TIMEOUT_MS = 750;

type CSSValuePX = `${number}px`;
type CSSValuePct = `${number}%`;
type CSSValue = CSSValuePX | CSSValuePct;
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

type Side = {
  content: ReactNode;
  default?: CSSValuePct;
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

function getValFromSide<Field extends keyof Side>(side: Side, field: Field) {
  return side && typeof side === 'object' && field in side ? side[field] : undefined;
}

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
    return {a: '50%' as CSSValuePct};
  }
  const a = getValFromSide(props.top, 'default');
  if (a) {
    return {a};
  }
  const b = getValFromSide(props.bottom, 'default');
  if (b) {
    return {b};
  }
  return {a: '50%' as CSSValuePct};
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

function SplitPanel(props: Props) {
  const [isMousedown, setIsMousedown] = useState(false);
  const [sizeCSS, setSizeCSS] = useState(getSplitDefault(props));
  const sizeCSSRef = useRef<undefined | CSSValuePct>();
  sizeCSSRef.current = sizeCSS.a;

  const {setStartPosition, logEndPosition} = useSplitPanelTracking({
    slideDirection: 'left' in props ? 'leftright' : 'updown',
  });

  const onTimeout = useCallback(() => {
    setIsMousedown(false);
    logEndPosition(sizeCSSRef.current);
  }, [logEndPosition]);
  const {start: startMouseIdleTimer, cancel: cancelMouseIdleTimer} = useTimeout({
    timeMs: MOUSE_RELEASE_TIMEOUT_MS,
    onTimeout,
  });

  const handleMouseDown = useCallback(() => {
    setIsMousedown(true);
    setStartPosition(sizeCSSRef.current);

    document.addEventListener(
      'mouseup',
      () => {
        setIsMousedown(false);
        cancelMouseIdleTimer();
        logEndPosition(sizeCSSRef.current);
      },
      {once: true}
    );

    startMouseIdleTimer();
  }, [cancelMouseIdleTimer, logEndPosition, setStartPosition, startMouseIdleTimer]);

  const handlePositionChange = useCallback(
    params => {
      if (params) {
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
    [props, startMouseIdleTimer]
  );

  const mouseTrackingProps = useMouseTracking<HTMLDivElement>({
    onPositionChange: handlePositionChange,
  });

  const activeTrackingProps = isMousedown ? mouseTrackingProps : {};

  if ('left' in props) {
    const {left: a, right: b} = props;

    return (
      <SplitPanelContainer orientation="columns" size={sizeCSS} {...activeTrackingProps}>
        <Panel>{getValFromSide(a, 'content') || a}</Panel>
        <Divider
          slideDirection="leftright"
          isMousedown={isMousedown}
          onMouseDown={handleMouseDown}
        />
        <Panel>{getValFromSide(b, 'content') || b}</Panel>
      </SplitPanelContainer>
    );
  }
  const {top: a, bottom: b} = props;
  return (
    <SplitPanelContainer orientation="rows" size={sizeCSS} {...activeTrackingProps}>
      <Panel>{getValFromSide(a, 'content') || a}</Panel>
      <Divider
        slideDirection="updown"
        isMousedown={isMousedown}
        onMouseDown={handleMouseDown}
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

type DividerProps = {isMousedown: boolean; slideDirection: 'leftright' | 'updown'};
const Divider = styled(
  ({
    isMousedown: _a,
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

  ${p => (p.isMousedown ? 'user-select: none;' : '')}

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
