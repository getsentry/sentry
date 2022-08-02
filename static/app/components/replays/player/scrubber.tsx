import styled from '@emotion/styled';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import * as Progress from 'sentry/components/replays/progress';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {divide} from 'sentry/components/replays/utils';
import space from 'sentry/styles/space';

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
        {currentHoverTime ? <MouseTrackingValue percent={hoverPlace} /> : null}
        <PlaybackTimeValue percent={percentComplete} />
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
`;

export const PlayerScrubber = styled(Scrubber)`
  height: ${space(0.5)};

  :hover {
    margin-block: -${space(0.25)};
    height: ${space(1)};
  }
`;
