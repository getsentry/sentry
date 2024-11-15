import {Fragment} from 'react';
import styled from '@emotion/styled';

import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import SliderAndInputWrapper from 'sentry/components/forms/controls/rangeSlider/sliderAndInputWrapper';
import TimelineTooltip from 'sentry/components/replays/breadcrumbs/replayTimelineTooltip';
import * as Progress from 'sentry/components/replays/progress';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFormattedDate, shouldUse24Hours} from 'sentry/utils/dates';
import formatDuration from 'sentry/utils/duration/formatDuration';
import divide from 'sentry/utils/number/divide';
import toPercent from 'sentry/utils/number/toPercent';
import useTimelineScale from 'sentry/utils/replays/hooks/useTimelineScale';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import useCurrentHoverTime from 'sentry/utils/replays/playback/providers/useCurrentHoverTime';

type Props = {
  className?: string;
  showZoomIndicators?: boolean;
};

function Scrubber({className, showZoomIndicators = false}: Props) {
  const {replay, currentTime, setCurrentTime} = useReplayContext();
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;
  const [currentHoverTime] = useCurrentHoverTime();
  const [timelineScale] = useTimelineScale();

  const startTimestamp = replay?.getStartTimestampMs() ?? 0;
  const durationMs = replay?.getDurationMs() ?? 0;
  const percentComplete = divide(currentTime, durationMs);
  const hoverPlace = divide(currentHoverTime || 0, durationMs);

  const initialTranslate = 0.5 / timelineScale;

  const starting = percentComplete < initialTranslate;
  const ending = percentComplete + initialTranslate > 1;

  const translate = () => {
    if (starting) {
      return 0;
    }
    if (ending) {
      return 1 - 2 * initialTranslate;
    }
    return currentTime > durationMs ? 1 : percentComplete - initialTranslate;
  };

  return (
    <Wrapper className={className}>
      {showZoomIndicators ? (
        <Fragment>
          <ZoomIndicatorContainer style={{left: toPercent(translate())}}>
            <ZoomTriangleDown />
            <ZoomIndicator />
          </ZoomIndicatorContainer>
          <ZoomIndicatorContainer
            style={{left: toPercent(translate() + 2 * initialTranslate)}}
          >
            <ZoomTriangleDown />
            <ZoomIndicator />
          </ZoomIndicatorContainer>
        </Fragment>
      ) : null}
      <Meter>
        {currentHoverTime ? (
          <div>
            <TimelineTooltip
              labelText={
                timestampType === 'absolute'
                  ? getFormattedDate(
                      startTimestamp + currentHoverTime,
                      shouldUse24Hours() ? 'HH:mm:ss.SSS' : 'hh:mm:ss.SSS',
                      {
                        local: true,
                      }
                    )
                  : formatDuration({
                      duration: [currentHoverTime, 'ms'],
                      precision: 'ms',
                      style: 'hh:mm:ss.sss',
                    })
              }
            />
            <MouseTrackingValue
              style={{
                width: toPercent(hoverPlace),
              }}
            />
          </div>
        ) : null}
        <PlaybackTimeValue
          style={{
            width: toPercent(percentComplete),
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
          aria-label={t('Seek slider')}
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

const ZoomIndicatorContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${space(0.75)};
  translate: -6px;
  top: -12px;
`;

const ZoomIndicator = styled('div')`
  border-right: ${space(0.25)} solid ${p => p.theme.gray500};
  height: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
`;

const ZoomTriangleDown = styled('div')`
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid ${p => p.theme.gray500};
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
    translate: -3px;

    /**
     * Draw the circle (appears on hover) to mark the currentTime of the video
     * "---------o-------------------- duration = 1:00"
     *           ^
     *           PlaybackTimeValue @ 20s
     */
    :after {
      background: ${p => p.theme.purple300};
    }
  }

  ${MouseTrackingValue} {
    background: ${p => p.theme.translucentBorder};
    border-radius: ${p => p.theme.borderRadius};
    translate: -3px;

    /**
     * Draw a square so users can see their mouse position when it is left or right of the currentTime
     * "----□----o--------------------- duration = 1:00"
     *      ^    ^
     *      |    PlaybackTimeValue @ 20s
     *      MouseTrackingValue @ 10s
     */
    :after {
      background: ${p => p.theme.gray300};
    }
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
`;
