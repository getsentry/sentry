import type {CSSProperties, ReactNode} from 'react';
import {useRef} from 'react';
import {css} from '@emotion/react';

import divide from 'sentry/utils/number/divide';
import useReplayPlayerState from 'sentry/utils/replays/playback/providers/useReplayPlayerState';
import {useDimensions} from 'sentry/utils/useDimensions';

interface Props {
  /**
   * You must pass `styles` into the <ReplayPlayer>,
   */
  children: (styles: CSSProperties) => ReactNode;

  /**
   * How to measure and resize the player.
   *
   * "both"
   *    The default. Measure the player fully. Resize the player to fit within
   *    the given width & height. Useful if you want to reserve some space for
   *    the replay.
   *    ie: with a wrapper that has CSS `height` set.
   *
   * "width"
   *    Height available will not be measured. The replay will be
   *   resized to accomodate the width available, and the height grows to
   *   maintain the aspect-ratio. This can result in really tall replays when
   *   captured on a mobile device.
   *
   * There is no "height" option, document flow doesn't usually expand in an
   * uncontrolled way like height does.
   */
  measure?: 'both' | 'width';
}

export default function ReplayPlayerContainment({children, measure = 'both'}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const measuredDimensions = useDimensions({elementRef});
  const playerState = useReplayPlayerState();

  const parentDimensions = {
    width: measuredDimensions.width,
    height: measure === 'width' ? Number.MAX_SAFE_INTEGER : measuredDimensions.height,
  };
  const childDimensions = playerState.dimensions;

  const scale = Math.min(
    divide(parentDimensions.height, childDimensions.height),
    divide(parentDimensions.width, childDimensions.width),
    1.5
  );

  // TODO: set the `scale` into a provider, so that we can read it back
  // elsewhere and potentially print it to the screen.

  const scaleStyle = {transform: `scale(${scale})`};
  const dimensions = {
    width: childDimensions.width * scale,
    height: childDimensions.height * scale,
  };

  return (
    <div css={[commonCss, measurableElemCss]} ref={elementRef}>
      <div css={[commonCss, centeredContentCss]} style={dimensions}>
        {children(scaleStyle)}
      </div>
    </div>
  );
}

const commonCss = css`
  display: flex;
  flex-grow: 1;
  place-items: center;
  place-content: center;
  width: 100%;
`;
const measurableElemCss = css`
  height: 100%;
`;
const centeredContentCss = css`
  position: relative;
  overflow: hidden;
`;
