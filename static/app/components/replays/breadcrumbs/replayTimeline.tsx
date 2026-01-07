import {useRef} from 'react';
import styled from '@emotion/styled';

import Stacked from 'sentry/components/container/stacked';
import Placeholder from 'sentry/components/placeholder';
import {
  MajorGridlines,
  MinorGridlines,
} from 'sentry/components/replays/breadcrumbs/gridlines';
import ReplayTimelineEvents from 'sentry/components/replays/breadcrumbs/replayTimelineEvents';
import TimelineGaps from 'sentry/components/replays/breadcrumbs/timelineGaps';
import {TimelineScrubber} from 'sentry/components/replays/player/scrubber';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import divide from 'sentry/utils/number/divide';
import toPercent from 'sentry/utils/number/toPercent';
import useTimelineScale from 'sentry/utils/replays/hooks/useTimelineScale';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {useDimensions} from 'sentry/utils/useDimensions';

export default function ReplayTimeline() {
  const replay = useReplayReader();
  const {currentTime} = useReplayContext();
  const [timelineScale] = useTimelineScale();

  const stackedRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions<HTMLDivElement>({elementRef: stackedRef});

  if (!replay) {
    return <Placeholder height="20px" />;
  }

  const durationMs = replay.getDurationMs();
  const startTimestampMs = replay.getStartTimestampMs();
  const chapterFrames = replay.getChapterFrames();
  const videoEvents = replay.getVideoEvents();

  // timeline is in the middle
  const initialTranslate = 0.5 / timelineScale;
  const percentComplete = divide(currentTime, durationMs);

  const starting = percentComplete < initialTranslate;
  const ending = percentComplete + initialTranslate > 1;

  const translate = () => {
    if (starting) {
      return 0;
    }
    if (ending) {
      return initialTranslate - (1 - initialTranslate);
    }
    return initialTranslate - (currentTime > durationMs ? 1 : percentComplete);
  };

  return (
    <CenteredStack
      style={{
        width: `${toPercent(timelineScale)}`,
        translate: `${toPercent(translate())} 0%`,
      }}
      ref={stackedRef}
    >
      <VisibleStack>
        <VisiblePanel />
        <MajorGridlines durationMs={durationMs} width={width} />
        <MinorGridlines durationMs={durationMs} width={width} />
        <TimelineGaps
          durationMs={durationMs}
          startTimestampMs={startTimestampMs}
          videoEvents={videoEvents}
        />
      </VisibleStack>

      <TimelineScrubber />

      <VisibleStack>
        <ReplayTimelineEvents
          durationMs={durationMs}
          frames={chapterFrames}
          startTimestampMs={startTimestampMs}
          width={width}
        />
      </VisibleStack>
    </CenteredStack>
  );
}

const CenteredStack = styled(Stacked)`
  align-items: center;
  position: absolute;
`;

const VisibleStack = styled(Stacked)`
  height: 100%;
  width: 100%;
`;

const VisiblePanel = styled('div')`
  border-radius: ${p => p.theme.radius.md};
  height: 100%;
  width: 100%;
  margin: 0;
  border: 0;
  background: ${p => p.theme.tokens.border.transparent.neutral.muted};
`;
