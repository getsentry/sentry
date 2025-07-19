import {useCallback, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayCurrentTime from 'sentry/components/replays/player/replayCurrentTime';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import {useScrubberMouseTracking} from 'sentry/components/replays/player/useScrubberMouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useTimelineScale, {
  TimelineScaleContextProvider,
} from 'sentry/utils/replays/hooks/useTimelineScale';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import useOrganization from 'sentry/utils/useOrganization';

type TimeAndScrubberGridProps = {
  isCompact?: boolean;
  isLoading?: boolean;
  showZoom?: boolean;
};

function TimelineSizeBar({isLoading}: {isLoading?: boolean}) {
  const {replay} = useReplayContext();
  const organization = useOrganization();
  const [timelineScale, setTimelineScale] = useTimelineScale();
  const durationMs = replay?.getDurationMs();
  const maxScale = durationMs ? Math.ceil(durationMs / 60000) : 10;

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(timelineScale - 1, 1);
    setTimelineScale(newScale);
    trackAnalytics('replay.timeline.zoom-out', {
      organization,
    });
  }, [timelineScale, setTimelineScale, organization]);

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(timelineScale + 1, maxScale);
    setTimelineScale(newScale);
    trackAnalytics('replay.timeline.zoom-in', {
      organization,
    });
  }, [timelineScale, maxScale, setTimelineScale, organization]);

  return (
    <ButtonBar gap="none">
      <Button
        size="xs"
        title={t('Zoom out')}
        icon={<IconSubtract />}
        borderless
        onClick={handleZoomOut}
        aria-label={t('Zoom out')}
        disabled={timelineScale === 1 || isLoading}
      />
      <span>
        {timelineScale}
        {'\u00D7'}
      </span>
      <Button
        size="xs"
        title={t('Zoom in')}
        icon={<IconAdd />}
        borderless
        onClick={handleZoomIn}
        aria-label={t('Zoom in')}
        disabled={timelineScale === maxScale || isLoading}
      />
    </ButtonBar>
  );
}

export default function TimeAndScrubberGrid({
  isCompact = false,
  showZoom = false,
  isLoading,
}: TimeAndScrubberGridProps) {
  const {replay} = useReplayContext();
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;
  const startTimestamp = replay?.getStartTimestampMs() ?? 0;
  const durationMs = replay?.getDurationMs();
  const timelineElemRef = useRef<HTMLDivElement>(null);
  const timelineMouseTrackingProps = useScrubberMouseTracking({elem: timelineElemRef});
  const scrubberElemRef = useRef<HTMLDivElement>(null);
  const scrubberMouseTrackingProps = useScrubberMouseTracking({elem: scrubberElemRef});

  return (
    <TimelineScaleContextProvider>
      <Grid id="replay-timeline-player" isCompact={isCompact}>
        <Padded style={{gridArea: 'currentTime'}}>
          <ReplayCurrentTime />
        </Padded>

        <TimelineWrapper
          style={{gridArea: 'timeline'}}
          ref={timelineElemRef}
          {...timelineMouseTrackingProps}
        >
          <ReplayTimeline />
        </TimelineWrapper>

        {showZoom ? (
          <div style={{gridArea: 'timelineSize'}}>
            <TimelineSizeBar isLoading={isLoading} />
          </div>
        ) : null}

        <ScrubberWrapper
          style={{gridArea: 'scrubber'}}
          ref={scrubberElemRef}
          {...scrubberMouseTrackingProps}
        >
          <PlayerScrubber showZoomIndicators={showZoom} />
        </ScrubberWrapper>

        <Padded style={{gridArea: 'duration'}}>
          {durationMs === undefined ? (
            '--:--'
          ) : timestampType === 'absolute' ? (
            <DateTime timeOnly seconds date={startTimestamp + durationMs} />
          ) : (
            <Duration duration={[durationMs, 'ms']} precision="sec" />
          )}
        </Padded>
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

  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  font-variant-numeric: tabular-nums;
  font-weight: ${p => p.theme.fontWeight.bold};
  ${p =>
    p.isCompact
      ? css`
          order: -1;
          min-width: 100%;
          margin-top: -8px;
        `
      : ''}
`;

const TimelineWrapper = styled('div')`
  height: 28px;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
`;

const ScrubberWrapper = styled('div')`
  height: 32px;
  display: flex;
  align-items: center;
`;

const Padded = styled('div')`
  display: flex;
  justify-content: center;
  padding-inline: ${space(1.5)};
`;
