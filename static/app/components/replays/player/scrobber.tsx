import React from 'react';
import styled from '@emotion/styled';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import space from 'sentry/styles/space';

type Props = {
  className?: string;
};

function getPercentComplete(currentTime: number, duration: number | undefined) {
  if (duration === undefined || isNaN(duration)) {
    return 0;
  }
  return currentTime / duration;
}

function Scrobber({className}: Props) {
  const {currentTime, duration, setCurrentTime} = useReplayContext();

  const percentComplete = getPercentComplete(currentTime, duration);

  return (
    <Wrapper className={className}>
      <Meter>
        <Value percent={percentComplete} />
      </Meter>
      <RangeWrapper>
        <Range
          data-test-id="replay-timeline-range"
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

const Meter = styled('div')`
  background: ${p => p.theme.gray200};
  width: 100%;
  height: 100%;
  position: relative;
`;

const Value = styled('span')<{percent: number}>`
  display: inline-block;
  position: absolute;
  background: ${p => p.theme.purple400};
  width: ${p => p.percent * 100}%;
  height: 100%;
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

const Wrapper = styled('div')`
  position: relative;

  width: 100%;
  height: ${space(0.5)};

  & > * {
    position: absolute;
    top: 0;
    left: 0;
  }

  :hover {
    margin-block: -${space(0.25)};
    height: ${space(1)};
  }

  ${Value}:after {
    content: '';
    display: block;
    width: ${space(2)};
    height: ${space(2)}; /* equal to width */
    background: ${p => p.theme.purple400};
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

  :hover ${Value}:after {
    opacity: 1;
  }

  ${RangeWrapper} {
    height: ${space(0.5)};
  }
  :hover ${RangeWrapper} {
    height: ${space(0.75)};
  }
`;

export default Scrobber;
