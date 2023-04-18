import styled from '@emotion/styled';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import SliderAndInputWrapper from 'sentry/components/forms/controls/rangeSlider/sliderAndInputWrapper';
import * as Progress from 'sentry/components/replays/progress';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {divide} from 'sentry/components/replays/utils';
import {space} from 'sentry/styles/space';

type Props = {
  className?: string;
};

function Scrubber({className}: Props) {
  const {currentHoverTime, currentTime, replay, setCurrentTime} = useReplayContext();
  const durationMs = replay?.getDurationMs();

  const percentComplete = divide(currentTime, durationMs);
  const hoverPlace = divide(currentHoverTime || 0, durationMs);

  return (
    <Wrapper className={className}>
      <Meter>
        {currentHoverTime ? (
          <MouseTrackingValue
            style={{
              width: hoverPlace * 100 + '%',
            }}
          />
        ) : null}
        <PlaybackTimeValue
          style={{
            width: percentComplete * 100 + '%',
          }}
        />
      </Meter>
      <RangeWrapper>
        <Range
          name="replay-timeline"
          min={0}
          max={durationMs}
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

    &::-webkit-slider-thumb {
      height: 0px;
      width: 0px;
    }

    &::-moz-range-thumb {
      height: 0px;
      width: 0px;
    }

    &::-ms-thumb {
      height: 0px;
      width: 0px;
    }
  }
`;

// Need the named value so we can target it separatly from PlaybackTimeValue
const PlaybackTimeValue = styled(Progress.Value)``;
const MouseTrackingValue = styled(Progress.Value)``;

const Wrapper = styled('div')`
  position: relative;

  width: 100%;

  & > * {
    position: absolute;
    top: 0;
    left: 0;
  }
`;

export const TimelineScrubber = styled(Scrubber)`
  height: 100%;

  ${Meter} {
    background: transparent;
  }

  ${RangeWrapper},
  ${Range},
  ${SliderAndInputWrapper} {
    height: 100%;
  }

  ${PlaybackTimeValue} {
    background: ${p => p.theme.purple100};
  }

  /**
   * Draw lines so users can see the currenTime & their mouse position
   * "----|----|--------------------- duration = 1:00"
   *      ^    ^
   *      |    PlaybackTimeValue @ 20s
   *      MouseTrackingValue @ 10s
   */
  ${PlaybackTimeValue},
  ${MouseTrackingValue} {
    border-right: ${space(0.25)} solid ${p => p.theme.purple300};
  }
`;

export const PlayerScrubber = styled(Scrubber)`
  height: ${space(0.5)};

  ${Meter} {
    border-radius: ${p => p.theme.borderRadius};
    background: ${p => p.theme.translucentInnerBorder};
  }

  ${RangeWrapper} {
    height: 32px;
    top: -14px;
  }
  ${Range},
  ${SliderAndInputWrapper} {
    height: 100%;
  }
  input {
    margin: 0;
  }

  ${PlaybackTimeValue} {
    background: ${p => p.theme.purple200};
    border-radius: ${p => p.theme.borderRadius};
  }

  ${MouseTrackingValue} {
    background: ${p => p.theme.translucentBorder};
    border-radius: ${p => p.theme.borderRadius};
  }

  ${PlaybackTimeValue}:after,
  ${MouseTrackingValue}:after {
    content: '';
    display: block;
    width: ${space(2)};
    height: ${space(2)}; /* equal to width */
    pointer-events: none;
    box-sizing: content-box;
    border-radius: ${space(2)}; /* greater than or equal to width */
    border: solid ${p => p.theme.white};
    border-width: ${space(0.25)};
    position: absolute;
    top: -${space(1)}; /* Half of the height */
    right: -${space(1.5)}; /* Half of (width + borderWidth) */
    z-index: ${p => p.theme.zIndex.initial};
  }

  /**
   * Draw the circle (appears on hover) to mark the currentTime of the video
   * "---------o-------------------- duration = 1:00"
   *           ^
   *           PlaybackTimeValue @ 20s
   */
  ${PlaybackTimeValue}:after {
    background: ${p => p.theme.purple300};
  }

  /*
   * Draw a square so users can see their mouse position when it is left or right of the currentTime
   * "----□----o--------------------- duration = 1:00"
   *      ^    ^
   *      |    PlaybackTimeValue @ 20s
   *      MouseTrackingValue @ 10s
   */
  ${MouseTrackingValue}:after {
    background: ${p => p.theme.gray300};
  }
`;
