import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import useScrubberMouseTracking from 'sentry/components/replays/player/useScrubberMouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useTimelineScale, {
  TimelineScaleContextProvider,
} from 'sentry/utils/replays/hooks/useTimelineScale';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';

type TimeAndScrubberGridProps = {
  isCompact?: boolean;
  showZoom?: boolean;
};

function TimelineSizeBar() {
  const {replay} = useReplayContext();
  const [timelineScale, setTimelineScale] = useTimelineScale();
  const durationMs = replay?.getDurationMs();
  const maxScale = durationMs ? Math.ceil(durationMs / 60000) : 10;

  return (
    <ButtonBar gap={0.5}>
      <Button
        size="xs"
        title={t('Zoom out')}
        icon={<IconSubtract />}
        borderless
        onClick={() => setTimelineScale(Math.max(timelineScale - 1, 1))}
        aria-label={t('Zoom out')}
        disabled={timelineScale === 1}
      />
      <Numeric>
        {timelineScale}
        {'\u00D7'}
      </Numeric>
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

export default function TimeAndScrubberGrid({
  isCompact = false,
  showZoom = false,
}: TimeAndScrubberGridProps) {
  const {currentTime, replay} = useReplayContext();
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;
  const startTimestamp = replay?.getStartTimestampMs() ?? 0;
  const durationMs = replay?.getDurationMs();
  const elem = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem});

  return (
    <TimelineScaleContextProvider>
      <Grid id="replay-timeline-player" isCompact={isCompact}>
        <Numeric style={{gridArea: 'currentTime'}}>
          {timestampType === 'absolute' ? (
            <DateTime timeOnly seconds date={startTimestamp + currentTime} />
          ) : (
            <Duration duration={[currentTime, 'ms']} precision="sec" />
          )}
        </Numeric>

        <div style={{gridArea: 'timeline'}}>
          <ReplayTimeline />
        </div>
        <TimelineSize style={{gridArea: 'timelineSize'}}>
          {showZoom ? <TimelineSizeBar /> : null}
        </TimelineSize>
        <StyledScrubber style={{gridArea: 'scrubber'}} ref={elem} {...mouseTrackingProps}>
          <PlayerScrubber showZoomIndicators={showZoom} />
        </StyledScrubber>
        <Numeric style={{gridArea: 'duration'}}>
          {durationMs === undefined ? (
            '--:--'
          ) : timestampType === 'absolute' ? (
            <DateTime timeOnly seconds date={startTimestamp + durationMs} />
          ) : (
            <Duration duration={[durationMs, 'ms']} precision="sec" />
          )}
        </Numeric>
      </Grid>
    </TimelineScaleContextProvider>
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

const Numeric = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  font-variant-numeric: tabular-nums;
  font-weight: ${p => p.theme.fontWeightBold};
  padding-inline: ${space(1.5)};
`;

const TimelineSize = styled('div')`
  font-variant-numeric: tabular-nums;
`;
