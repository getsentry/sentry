import {DOMAttributes, ReactNode, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {IconGrabbable} from 'sentry/icons';
import space from 'sentry/styles/space';
import useMouseTracking from 'sentry/utils/replays/hooks/useMouseTracking';

const BAR_THICKNESS = 16;
const HALF_BAR = BAR_THICKNESS / 2;

type Props =
  | {
      left: ReactNode;
      right: ReactNode;
    }
  | {
      bottom: ReactNode;
      top: ReactNode;
    };

function SplitPanel(props: Props) {
  const [mousedown, setMousedown] = useState(false);
  const [sizePct, setSizePct] = useState(0.5);

  const handlePositionChange = useCallback(
    params => {
      if (mousedown && params) {
        const {left, top, width, height} = params;
        if ('left' in props) {
          setSizePct((left - HALF_BAR) / width);
        } else {
          setSizePct((top - HALF_BAR) / height);
        }
      }
    },
    [mousedown, Boolean('left' in props)] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const mouseTrackingProps = useMouseTracking({onPositionChange: handlePositionChange});

  if ('left' in props) {
    const {left: a, right: b} = props;

    return (
      <Canvas orientation="columns" sizePct={sizePct} {...mouseTrackingProps}>
        <Panel>{a}</Panel>
        <Divider
          slideDirection="leftright"
          mousedown={mousedown}
          onMouseDown={() => setMousedown(true)}
          onMouseUp={() => setMousedown(false)}
        />
        <Panel>{b}</Panel>
      </Canvas>
    );
  }
  const {top: a, bottom: b} = props;
  return (
    <Canvas orientation="rows" sizePct={sizePct} {...mouseTrackingProps}>
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

const Canvas = styled('div')<{orientation: 'rows' | 'columns'; sizePct: number}>`
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100%;
  display: grid;

  grid-template-${p => p.orientation}: ${p => p.sizePct * 100}% auto 1fr;
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
