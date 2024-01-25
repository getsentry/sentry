import {CSSProperties, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {
  MajorGridlines,
  MinorGridlines,
} from 'sentry/components/replays/breadcrumbs/gridlines';
import ReplayTimelineEvents from 'sentry/components/replays/breadcrumbs/replayTimelineEvents';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import {TimelineScrubber} from 'sentry/components/replays/player/scrubber';
import {useTimelineScrubberMouseTracking} from 'sentry/components/replays/player/useScrubberMouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {divide} from 'sentry/components/replays/utils';
import toPercent from 'sentry/utils/number/toPercent';
import {useDimensions} from 'sentry/utils/useDimensions';

type Props = {
  style?: CSSProperties;
};

function ReplayTimeline({style}: Props) {
  const {replay, currentTime, timelineScale, startTimeOffsetMs, durationMs} =
    useReplayContext();

  const panelRef = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useTimelineScrubberMouseTracking(
    {elem: panelRef},
    timelineScale
  );

  const stackedRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions<HTMLDivElement>({elementRef: stackedRef});

  const translate = useCallback(() => {
    const percentComplete = divide(currentTime - startTimeOffsetMs, durationMs);
    // timeline is in the middle
    const initialTranslate = 0.5 / timelineScale;

    const starting = percentComplete < initialTranslate;
    if (starting) {
      return 0;
    }
    const ending = percentComplete + initialTranslate > 1;
    if (ending) {
      return initialTranslate - (1 - initialTranslate);
    }
    return (
      initialTranslate -
      (currentTime - startTimeOffsetMs > durationMs ? 1 : percentComplete)
    );
  }, [currentTime, durationMs, startTimeOffsetMs, timelineScale]);

  if (!replay) {
    return <Placeholder style={style} height="20px" />;
  }

  const startTimestampMs = replay.getReplay().started_at.getTime() + startTimeOffsetMs;
  const chapterFrames = replay.getChapterFrames();

  return (
    <MouseArea ref={panelRef} style={style} {...mouseTrackingProps}>
      <VisiblePanel>
        <Stacked
          style={{
            width: `${toPercent(timelineScale)}`,
            transform: `translate(${toPercent(translate())}, 0%)`,
          }}
          ref={stackedRef}
        >
          <MinorGridlines durationMs={durationMs} width={width} />
          <MajorGridlines durationMs={durationMs} width={width} />
          <TimelineScrubber />
          <TimelineEventsContainer>
            <ReplayTimelineEvents
              durationMs={durationMs}
              frames={chapterFrames}
              startTimestampMs={startTimestampMs}
              width={width}
              startTimeOffsetMs={startTimeOffsetMs}
            />
          </TimelineEventsContainer>
        </Stacked>
      </VisiblePanel>
    </MouseArea>
  );
}

const MouseArea = styled('div')`
  display: flex;
  justify-self: stretch;
  align-self: stretch;
  align-items: center;
  cursor: pointer;
`;

const VisiblePanel = styled(Panel)`
  flex-grow: 1;
  margin: 0;
  border: 0;
  background: ${p => p.theme.translucentInnerBorder};
`;

const TimelineEventsContainer = styled('div')`
  padding-top: 10px;
  padding-bottom: 10px;
`;

export default ReplayTimeline;
