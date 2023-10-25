import {useRef} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {
  MajorGridlines,
  MinorGridlines,
} from 'sentry/components/replays/breadcrumbs/gridlines';
import ReplayTimelineEvents from 'sentry/components/replays/breadcrumbs/replayTimelineEvents';
import ReplayTimelineSpans from 'sentry/components/replays/breadcrumbs/replayTimelineSpans';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import {
  CompactTimelineScrubber,
  TimelineScrubber,
} from 'sentry/components/replays/player/scrubber';
import useScrubberMouseTracking from 'sentry/components/replays/player/useScrubberMouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {};

function ReplayTimeline({}: Props) {
  const {replay} = useReplayContext();

  const panelRef = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem: panelRef});

  const stackedRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions<HTMLDivElement>({elementRef: stackedRef});

  const organization = useOrganization();
  const hasNewTimeline = organization.features.includes('session-replay-new-timeline');

  if (!replay) {
    return <Placeholder height={hasNewTimeline ? '20px' : '54px'} />;
  }

  const durationMs = replay.getDurationMs();
  const startTimestampMs = replay.getReplay().started_at.getTime();
  const chapterFrames = replay.getChapterFrames();
  const networkFrames = replay.getNetworkFrames();

  return hasNewTimeline ? (
    <PanelNoMarginBorder ref={panelRef} {...mouseTrackingProps}>
      <Stacked ref={stackedRef}>
        <CompactTimelineScrubber />
        <TimelineEventsContainer>
          <ReplayTimelineEvents
            durationMs={durationMs}
            frames={chapterFrames}
            startTimestampMs={startTimestampMs}
            width={width}
          />
        </TimelineEventsContainer>
      </Stacked>
    </PanelNoMarginBorder>
  ) : (
    <PanelNoMargin ref={panelRef} {...mouseTrackingProps}>
      <Stacked ref={stackedRef}>
        <MinorGridlines durationMs={durationMs} width={width} />
        <MajorGridlines durationMs={durationMs} width={width} />
        <TimelineScrubber />
        <div style={{paddingTop: '36px'}}>
          <ReplayTimelineSpans
            durationMs={durationMs}
            frames={networkFrames}
            startTimestampMs={startTimestampMs}
          />
        </div>
        <div style={{paddingTop: '26px'}}>
          <ReplayTimelineEvents
            durationMs={durationMs}
            frames={chapterFrames}
            startTimestampMs={startTimestampMs}
            width={width}
          />
        </div>
      </Stacked>
    </PanelNoMargin>
  );
}

const PanelNoMargin = styled(Panel)`
  margin: 0;
`;

const PanelNoMarginBorder = styled(Panel)`
  margin: 0;
  border: 0;
`;

const TimelineEventsContainer = styled('div')`
  padding-top: 10px;
  padding-bottom: 10px;
`;

export default ReplayTimeline;
