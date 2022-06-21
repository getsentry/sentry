import React from 'react';
import styled from '@emotion/styled';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import SliderAndInputWrapper from 'sentry/components/forms/controls/rangeSlider/sliderAndInputWrapper';
import * as Progress from 'sentry/components/replays/progress';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {divide} from 'sentry/components/replays/utils';
import space from 'sentry/styles/space';

type Props = {
  className?: string;
};

function Scrubber({className}: Props) {
  const {currentHoverTime, currentTime, duration, setCurrentTime} = useReplayContext();

  const percentComplete = divide(currentTime, duration);
  const hoverPlace = divide(currentHoverTime || 0, duration);

  return (
    <Wrapper className={className}>
      <Meter>
        {currentHoverTime ? <MouseTrackingValue percent={hoverPlace} /> : null}
        <PlaybackTimeValue percent={percentComplete} />
      </Meter>
      <RangeWrapper>
        <Range
          name="replay-timeline"
          min={0}
          max={duration}
          value={Math.round(currentTime)}
          onChange={value => setCurrentTime(value || 0)}
          showLabel={false}
        />
      </RangeWrapper>
    </Wrapper>
  );
}

const Meter = styled(Progress.Meter)`
  background: ${p => p.theme.gray200};
`;

const RangeWrapper = styled('div')`
  overflow: hidden;
  width: 100%;
`;

const Range = styled(RangeSlider)`
  input {
    cursor: pointer;
    opacity: 0;
    height: 100%;
  }
`;

const PlaybackTimeValue = styled(Progress.Value)`
  background: ${p => p.theme.purple300};
`;

const MouseTrackingValue = styled(Progress.Value)`
  background: ${p => p.theme.purple200};
`;

const Wrapper = styled('div')`
  position: relative;

  width: 100%;

  & > * {
    position: absolute;
    top: 0;
    left: 0;
  }

  ${MouseTrackingValue}:after {
    content: '';
    display: block;
    width: ${space(0.5)};
    height: ${space(1.5)};
    pointer-events: none;
    background: ${p => p.theme.purple200};
    box-sizing: content-box;
    position: absolute;
    top: -${space(0.5)};
    right: -1px;
  }

  :hover ${MouseTrackingValue}:after {
    height: ${space(2)};
    top: -${space(0.5)};
  }
`;

export const TimelineScubber = styled(Scrubber)`
  height: 100%;

  ${Meter} {
    background: transparent;
  }

  ${PlaybackTimeValue} {
    opacity: 0.2;
  }

  ${RangeWrapper} {
    height: 100%;
  }

  ${Range} {
    height: 100%;
  }

  ${SliderAndInputWrapper} {
    height: 100%;
  }
`;

export const PlayerScrubber = styled(Scrubber)`
  height: ${space(0.5)};

  :hover {
    margin-block: -${space(0.25)};
    height: ${space(1)};
  }

  ${RangeWrapper} {
    height: ${space(0.5)};
  }
  :hover ${RangeWrapper} {
    height: ${space(0.75)};
  }

  ${PlaybackTimeValue}:after {
    content: '';
    display: block;
    width: ${space(2)};
    height: ${space(2)}; /* equal to width */
    z-index: ${p => p.theme.zIndex.initial};
    pointer-events: none;
    background: ${p => p.theme.purple300};
    box-sizing: content-box;
    border-radius: ${space(2)}; /* greater than or equal to width */
    border: solid ${p => p.theme.white};
    border-width: ${space(0.5)};
    position: absolute;
    top: -${space(1)}; /* Half the width */
    right: -${space(1.5)}; /* Half of (width + borderWidth) */
    opacity: 0;
    transition: opacity 0.1s ease;
  }
  :hover ${PlaybackTimeValue}:after {
    opacity: 1;
  }
`;
