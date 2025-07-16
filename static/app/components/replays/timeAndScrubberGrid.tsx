import {useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import {useScrubberMouseTracking} from 'sentry/components/replays/player/useScrubberMouseTracking';
import {TimelineScaleContextProvider} from 'sentry/utils/replays/hooks/useTimelineScale';

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
    <ButtonBar gap="xs">
      <Button
        size="xs"
        title={t('Zoom out')}
        icon={<IconSubtract />}
        borderless
        onClick={handleZoomOut}
        aria-label={t('Zoom out')}
        disabled={timelineScale === 1 || isLoading}
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
        onClick={handleZoomIn}
        aria-label={t('Zoom in')}
        disabled={timelineScale === maxScale || isLoading}
      />
    </ButtonBar>
  );
}

export default function TimeAndScrubberGrid({
  isCompact = false,
}: TimeAndScrubberGridProps) {
  const elem = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem});

  return (
    <TimelineScaleContextProvider>
      <Grid id="replay-timeline-player" isCompact={isCompact}>
        <ReplayTimeline />
      </Grid>
    </TimelineScaleContextProvider>
  );
}

const Grid = styled('div')<{isCompact: boolean}>`
  width: 100%;
  ${p =>
    p.isCompact
      ? css`
          order: -1;
          min-width: 100%;
          margin-top: -8px;
        `
      : ''}
`;
