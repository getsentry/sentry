import {type ReactNode, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayCurrentTime from 'sentry/components/replays/player/replayCurrentTime';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import ReplayPlayPauseButton from 'sentry/components/replays/player/replayPlayPauseButton';
import ReplayTotalTime from 'sentry/components/replays/player/replayTotalTime';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import useReplayAutoPause from 'sentry/components/replays/player/useReplayAutoPause';
import useScrubberMouseTracking from 'sentry/components/replays/player/useScrubberMouseTracking';
import {ReplayFullscreenButton} from 'sentry/components/replays/replayFullscreenButton';
import {space} from 'sentry/styles/space';
import {TimelineScaleContextProvider} from 'sentry/utils/replays/hooks/useTimelineScale';
import useFullscreen from 'sentry/utils/window/useFullscreen';

/**
 * This is a core playback UI for a replay
 *
 * You can render this inside a set of Providers and get a basic replay experience
 */
export default function ReplayPlayback() {
  useReplayAutoPause();

  return (
    <ReplayFullscreenWrapper>
      {toggleFullscreen => (
        <Flex column gap={space(2)}>
          <StyledNegativeSpaceContainer>
            <ReplayPlayerMeasurer measure="both">
              {style => <ReplayPlayer style={style} />}
            </ReplayPlayerMeasurer>
          </StyledNegativeSpaceContainer>
          <TimelineScaleContextProvider>
            <ReplayControlsGrid>
              <div style={{gridArea: 'left'}}>
                <ReplayPlayPauseButton priority="default" />
              </div>
              <Numeric style={{gridArea: 'currentTime'}}>
                <ReplayCurrentTime />
              </Numeric>
              <FillWidth style={{gridArea: 'timeline'}}>
                <ReplayTimeline />
              </FillWidth>
              <FillWidth style={{gridArea: 'scrubber'}}>
                <ReplayScrubber />
              </FillWidth>
              <Numeric style={{gridArea: 'duration'}}>
                <ReplayTotalTime />
              </Numeric>
              <div style={{gridArea: 'right'}}>
                <ReplayFullscreenButton toggleFullscreen={toggleFullscreen} />
              </div>
            </ReplayControlsGrid>
          </TimelineScaleContextProvider>
        </Flex>
      )}
    </ReplayFullscreenWrapper>
  );
}

function ReplayFullscreenWrapper({
  children,
}: {
  children: (toggle: () => void) => ReactNode;
}) {
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const {toggle} = useFullscreen({
    elementRef: fullscreenRef,
  });

  return <FullscreenBounds ref={fullscreenRef}>{children(toggle)}</FullscreenBounds>;
}
const FullscreenBounds = styled('div')`
  :fullscreen {
    padding: ${space(1)};
  }
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  height: 500px;
`;

const ReplayControlsGrid = styled('div')`
  width: 100%;
  display: grid;
  grid-template-areas:
    'left . timeline timelineSize right'
    'left currentTime scrubber duration right';
  grid-column-gap: ${space(1)};
  grid-template-columns: max-content max-content auto max-content max-content;
  align-items: center;
`;

const Numeric = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  font-variant-numeric: tabular-nums;
  font-weight: ${p => p.theme.fontWeightBold};
  padding-inline: ${space(1.5)};
`;

const FillWidth = styled('div')`
  width: 100%;
`;

function ReplayScrubber() {
  const elem = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem});

  return (
    <StyledScrubber ref={elem} {...mouseTrackingProps}>
      <PlayerScrubber />
    </StyledScrubber>
  );
}
const StyledScrubber = styled('div')`
  height: 32px;
  display: flex;
  align-items: center;
`;
