import {DOMAttributes, ReactNode, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import space from 'sentry/styles/space';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';

const BAR_THICKNESS = 16;
const HALF_BAR = BAR_THICKNESS / 2;

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

function getSplitDefault(props: Props) {
  const getDefaultVal = (side: Side) =>
    side && typeof side === 'object' && 'default' in side ? side.default : undefined;

  if ('left' in props) {
    return getDefaultVal(props.left) || getDefaultVal(props.right) || '50%';
  }
  return getDefaultVal(props.top) || getDefaultVal(props.bottom) || '50%';
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
  const [mousedown, setMousedown] = useState(false);
  const [sizePct, setSizePct] = useState(getSplitDefault(props));

  const handleMouseDown = useCallback(() => {
    setMousedown(true);
    document.addEventListener('mouseup', () => setMousedown(false), {once: true});
  }, []);

  const handlePositionChange = useCallback(
    params => {
      if (mousedown && params) {
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
          setSizePct(`${priPct * 100}%`);
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
          setSizePct(`${priPct * 100}%`);
        }
      }
    },
    [mousedown, props] // xeslint-disable-line react-hooks/exhaustive-deps
  );

  const mouseTrackingProps = useMouseTracking({onPositionChange: handlePositionChange});

  if ('left' in props) {
    const {left: a, right: b} = props;

    return (
      <Canvas orientation="columns" size={sizePct} {...mouseTrackingProps}>
        <Panel>{a}</Panel>
        <Divider
          slideDirection="leftright"
          mousedown={mousedown}
          onMouseDown={handleMouseDown}
        />
        <Panel>{b}</Panel>
      </Canvas>
    );
  }
  const {top: a, bottom: b} = props;
  return (
    <Canvas orientation="rows" size={sizePct} {...mouseTrackingProps}>
      <Panel>{a}</Panel>
      <Divider
        slideDirection="updown"
        onMouseDown={() => setMousedown(true)}
        onMouseUp={() => setMousedown(false)}
        mousedown={mousedown}
      />
      <Panel>{b}</Panel>
    </Canvas>
  );
}

const Canvas = styled('div')<{
  orientation: 'rows' | 'columns';
  size: CSSValue;
}>`
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  display: grid;

  grid-template-${p => p.orientation}: ${p => p.size} auto 1fr;
`;

const Panel = styled('div')`
  overflow: hidden;
`;

const Divider = styled((props: DOMAttributes<HTMLDivElement>) => (
  <div {...props}>
    <IconGrabbable size="sm" />
  </div>
))<{mousedown: boolean; slideDirection: 'leftright' | 'updown'}>`
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
