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
import {TimelineScrubber} from 'sentry/components/replays/player/scrubber';
import useScrubberMouseTracking from 'sentry/components/replays/player/useScrubberMouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import getFrameDetails from 'sentry/utils/replays/getFrameDetails';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {useDimensions} from 'sentry/utils/useDimensions';

type Props = {};

function ReplayTimeline({}: Props) {
  const {replay} = useReplayContext();
  const {onMouseEnter, onMouseLeave, onClickTimestamp} = useCrumbHandlers();

  const {setActiveTab} = useActiveReplayTab();

  const panelRef = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem: panelRef});

  const stackedRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions<HTMLDivElement>({elementRef: stackedRef});

  if (!replay) {
    return <Placeholder height="54px" bottomGutter={2} />;
  }

  const durationMs = replay.getDurationMs();
  const startTimestampMs = replay.getReplay().started_at.getTime();
  const chapterFrames = replay.getChapterFrames();
  const networkFrames = replay.getNetworkFrames();

  return (
    <Panel ref={panelRef} {...mouseTrackingProps}>
      <Stacked ref={stackedRef}>
        <MinorGridlines durationMs={durationMs} width={width} />
        <MajorGridlines durationMs={durationMs} width={width} />
        <TimelineScrubber />
        <UnderTimestamp paddingTop="36px">
          <ReplayTimelineSpans
            durationMs={durationMs}
            frames={networkFrames}
            startTimestampMs={startTimestampMs}
          />
        </UnderTimestamp>
        <UnderTimestamp paddingTop="26px">
          <ReplayTimelineEvents
            durationMs={durationMs}
            frames={chapterFrames}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClickTimestamp={frame => {
              onClickTimestamp(frame);
              setActiveTab(getFrameDetails(frame).tabKey);
            }}
            startTimestampMs={startTimestampMs}
            width={width}
          />
        </UnderTimestamp>
      </Stacked>
    </Panel>
  );
}

const UnderTimestamp = styled('div')<{paddingTop: string}>`
  /* Weird size to put equal space above/below a <small> node that MajorGridlines emits */
  padding-top: ${p => p.paddingTop};
`;

export default ReplayTimeline;
