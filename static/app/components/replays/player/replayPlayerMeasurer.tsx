import type {CSSProperties, ReactNode} from 'react';
import {useEffect, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import divide from 'sentry/utils/number/divide';
import {useReplayPlayerSize} from 'sentry/utils/replays/playback/providers/replayPlayerSizeContext';
import {useReplayPlayerState} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {useDimensions} from 'sentry/utils/useDimensions';

interface Props {
  /**
   * You must pass `styles` into the <ReplayPlayer>
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
   *    -> Use this when the container has a fixed height.
   *
   * "width"
   *    Height available will not be measured. The replay will be
   *   resized to accomodate the width available, and the height grows to
   *   maintain the aspect-ratio. This can result in really tall replays when
   *   captured on a mobile device.
   *
   *   -> Use this when the container has a flexible height, like if it's inside a
   *   grid or flex parent.
   *
   * There is no "height" option; document flow doesn't usually expand in an
   * uncontrolled way like height does.
   */
  measure?: 'both' | 'width';
}

// We use 1.5 because we want to scale up mobile replays
// (or other replays that have height > width) if they are smaller than the
// available space. The default is to scale-down to fit desktop replays within
// the (smaller) browser window.
const MAX_ZOOM = 1.5;

export default function ReplayPlayerMeasurer({children, measure = 'both'}: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const measuredDimensions = useDimensions({elementRef});
  const playerState = useReplayPlayerState();
  const [, setViewSize] = useReplayPlayerSize();

  const parentDimensions = {
    width: measuredDimensions.width,
    height: measure === 'width' ? Number.MAX_SAFE_INTEGER : measuredDimensions.height,
  };
  const childDimensions = playerState.dimensions;

  const scale = Math.min(
    divide(parentDimensions.height, childDimensions.height),
    divide(parentDimensions.width, childDimensions.width),
    MAX_ZOOM
  );

  const scaleStyle = {transform: `scale(${scale})`};
  const dimensions = {
    width: childDimensions.width * scale,
    height: childDimensions.height * scale,
  };

  useEffect(() => {
    setViewSize({
      width: childDimensions.width,
      height: childDimensions.height,
      scale,
    });
  }, [childDimensions.height, childDimensions.width, scale, setViewSize]);

  return (
    <MeasureableElem ref={elementRef}>
      <CenteredContent style={dimensions}>{children(scaleStyle)}</CenteredContent>
    </MeasureableElem>
  );
}

const commonCss = css`
  display: flex;
  flex-grow: 1;
  place-items: center;
  place-content: center;
  width: 100%;
`;
const MeasureableElem = styled('div')`
  ${commonCss}
  height: 100%;
`;
const CenteredContent = styled('div')`
  ${commonCss}
  position: relative;
  overflow: hidden;
`;
