import {css} from '@emotion/react';
import styled from '@emotion/styled';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import SliderAndInputWrapper from 'sentry/components/forms/controls/rangeSlider/sliderAndInputWrapper';
import ZoomTriangles from 'sentry/components/replays/player/zoomTrianges';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import divide from 'sentry/utils/number/divide';
import toPercent from 'sentry/utils/number/toPercent';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';

type Props = {
  className?: string;
  showZoomIndicators?: boolean;
};

function Scrubber({className, showZoomIndicators = false}: Props) {
  const replay = useReplayReader();
  const {currentTime, setCurrentTime} = useReplayContext();

  const [currentHoverTime] = useCurrentHoverTime();

  const durationMs = replay?.getDurationMs() ?? 0;
  const percentComplete = divide(currentTime, durationMs);
  const hoverPlace = divide(currentHoverTime || 0, durationMs);

  return (
    <Wrapper className={className}>
      <Meter>
        {currentHoverTime ? (
          <MouseTrackingValue style={{width: toPercent(hoverPlace)}} />
        ) : null}
        <PlaybackTimeValue style={{width: toPercent(percentComplete)}} />
      </Meter>
      {showZoomIndicators ? <ZoomTriangles /> : null}
      <RangeWrapper>
        <Range
          name="replay-timeline"
          min={0}
          max={durationMs}
          value={Math.round(currentTime)}
          onChange={value => setCurrentTime(value || 0)}
          showLabel={false}
          aria-label={t('Seek slider')}
        />
      </RangeWrapper>
    </Wrapper>
  );
}

const Meter = styled('div')`
  position: relative;
  height: 100%;
  width: 100%;
  pointer-events: none;
  background: ${p => p.theme.colors.gray200};
`;

const RangeWrapper = styled('div')`
  overflow: hidden;
  width: 100%;
`;

const Range = styled(RangeSlider)`
  & * {
    height: 100% !important;
  }
  input {
    margin: 0;
    cursor: pointer;
    opacity: 0;

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

const valueCss = css`
  max-width: 100%;
  position: absolute;
  height: 100%;
  pointer-events: none;
`;

// Need the named value so we can target it separatly from PlaybackTimeValue
const PlaybackTimeValue = styled('span')`
  ${valueCss}
`;
const MouseTrackingValue = styled('span')`
  ${valueCss}
`;

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
    height: 20px;
  }

  ${RangeWrapper},
  ${Range},
  ${SliderAndInputWrapper} {
    height: 100%;
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
    border-right: ${space(0.25)} solid ${p => p.theme.colors.blue400};
  }
`;

export const PlayerScrubber = styled(Scrubber)`
  height: ${space(0.5)};

  ${Meter} {
    border-radius: ${p => p.theme.radius.md};
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
    background: ${p => p.theme.colors.blue200};
    border-radius: ${p => p.theme.radius.md};

    /**
     * Draw the circle (appears on hover) to mark the currentTime of the video
     * "---------o-------------------- duration = 1:00"
     *           ^
     *           PlaybackTimeValue @ 20s
     */
    :after {
      background: ${p => p.theme.colors.blue400};
    }
  }

  ${MouseTrackingValue} {
    background: ${p => p.theme.translucentBorder};
    border-radius: ${p => p.theme.radius.md};

    /**
     * Draw a square so users can see their mouse position when it is left or right of the currentTime
     * "----□----o--------------------- duration = 1:00"
     *      ^    ^
     *      |    PlaybackTimeValue @ 20s
     *      MouseTrackingValue @ 10s
     */
    :after {
      background: ${p => p.theme.colors.gray500};
    }
  }

  ${PlaybackTimeValue}:after,
  ${MouseTrackingValue}:after {
    --size: ${space(2)};
    --borderWidth: ${space(0.25)};
    content: '';
    display: block;
    width: var(--size);
    height: var(--size);
    pointer-events: none;
    box-sizing: content-box;
    border-radius: var(--size);
    border: solid ${p => p.theme.white};
    border-width: var(--borderWidth);
    position: absolute;
    top: 0;
    right: calc((var(--size) + (var(--borderWidth) * 2)) / 2 * -1);
    translate: 0 calc(-50% + var(--borderWidth));
    z-index: ${p => p.theme.zIndex.initial};
  }
`;
