import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import useScrubberMouseTracking from 'sentry/components/replays/player/useScrubberMouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {formatTime} from 'sentry/components/replays/utils';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type TimeAndScrubberGridProps = {
  isCompact?: boolean;
  showZoom?: boolean;
};

function TimelineSizeBar() {
  const {replay, timelineScale, setTimelineScale} = useReplayContext();
  const durationMs = replay?.getDurationMs();
  const maxScale = durationMs ? Math.ceil(durationMs / 60000) : 10;

  return (
    <ButtonBar>
      <Button
        size="xs"
        title={t('Zoom out')}
        icon={<IconSubtract />}
        borderless
        onClick={() => setTimelineScale(Math.max(timelineScale - 1, 1))}
        aria-label={t('Zoom out')}
        disabled={timelineScale === 1}
      />
      <span style={{padding: `0 ${space(0.5)}`}}>
        {timelineScale}
        {t('x')}
      </span>
      <Button
        size="xs"
        title={t('Zoom in')}
        icon={<IconAdd />}
        borderless
        onClick={() => setTimelineScale(Math.min(timelineScale + 1, maxScale))}
        aria-label={t('Zoom in')}
        disabled={timelineScale === maxScale}
      />
    </ButtonBar>
  );
}

function TimeAndScrubberGrid({
  isCompact = false,
  showZoom = false,
}: TimeAndScrubberGridProps) {
  const {currentTime, replay} = useReplayContext();
  const durationMs = replay?.getDurationMs();
  const elem = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem});

  return (
    <Grid id="replay-timeline-player" isCompact={isCompact}>
      <Time style={{gridArea: 'currentTime'}}>{formatTime(currentTime)}</Time>
      <div style={{gridArea: 'timeline'}}>
        <ReplayTimeline />
      </div>
      <div style={{gridArea: 'timelineSize', fontVariantNumeric: 'tabular-nums'}}>
        {showZoom ? <TimelineSizeBar /> : null}
      </div>
      <StyledScrubber style={{gridArea: 'scrubber'}} ref={elem} {...mouseTrackingProps}>
        <PlayerScrubber showZoomIndicators={showZoom} />
      </StyledScrubber>
      <Time style={{gridArea: 'duration'}}>
        {durationMs ? formatTime(durationMs) : '--:--'}
      </Time>
    </Grid>
  );
}

const Grid = styled('div')<{isCompact: boolean}>`
  width: 100%;
  display: grid;
  grid-template-areas:
    '. timeline timelineSize'
    'currentTime scrubber duration';
  grid-column-gap: ${space(1)};
  grid-template-columns: max-content auto max-content;
  align-items: center;
  ${p =>
    p.isCompact
      ? `
        order: -1;
        min-width: 100%;
        margin-top: -8px;
      `
      : ''}
`;

const StyledScrubber = styled('div')`
  height: 32px;
  display: flex;
  align-items: center;
`;

const Time = styled('span')`
  font-variant-numeric: tabular-nums;
  padding: 0 ${space(1.5)};
`;

export default TimeAndScrubberGrid;
