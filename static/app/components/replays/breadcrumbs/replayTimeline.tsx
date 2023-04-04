import {useRef} from 'react';
import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels';
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
import {Resizeable} from 'sentry/components/replays/resizeable';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';

type Props = {};

const USER_ACTIONS = [
  BreadcrumbType.ERROR,
  BreadcrumbType.NAVIGATION,
  BreadcrumbType.UI,
  BreadcrumbType.USER,
];

const ReplayTimeline = ({}: Props) => {
  const {replay} = useReplayContext();

  const elem = useRef<HTMLDivElement>(null);
  const mouseTrackingProps = useScrubberMouseTracking({elem});

  if (!replay) {
    return <Placeholder height="54px" bottomGutter={2} />;
  }

  const durationMs = replay.getDurationMs();
  const startTimestampMs = replay.getReplay().started_at.getTime();
  const crumbs = replay.getRawCrumbs();
  const userCrumbs = crumbs.filter(crumb => USER_ACTIONS.includes(crumb.type));
  const networkSpans = replay.getNetworkSpans();

  return (
    <Panel ref={elem} {...mouseTrackingProps}>
      <Resizeable>
        {({width}) => (
          <Stacked>
            <MinorGridlines durationMs={durationMs} width={width} />
            <MajorGridlines durationMs={durationMs} width={width} />
            <TimelineScrubber />
            <UnderTimestamp paddingTop="36px">
              <ReplayTimelineSpans
                durationMs={durationMs}
                spans={networkSpans}
                startTimestampMs={startTimestampMs}
              />
            </UnderTimestamp>
            <UnderTimestamp paddingTop="26px">
              <ReplayTimelineEvents
                crumbs={userCrumbs}
                durationMs={durationMs}
                startTimestampMs={startTimestampMs}
                width={width}
              />
            </UnderTimestamp>
          </Stacked>
        )}
      </Resizeable>
    </Panel>
  );
};

const UnderTimestamp = styled('div')<{paddingTop: string}>`
  /* Weird size to put equal space above/below a <small> node that MajorGridlines emits */
  padding-top: ${p => p.paddingTop};
`;

export default ReplayTimeline;
