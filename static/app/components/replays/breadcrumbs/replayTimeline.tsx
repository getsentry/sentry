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
import ScrubberMouseTracking from 'sentry/components/replays/player/scrubberMouseTracking';
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

function ReplayTimeline({}: Props) {
  const {replay} = useReplayContext();

  if (!replay) {
    return <Placeholder height="48px" bottomGutter={2} />;
  }

  const durationMs = replay.getDurationMs();
  const startTimestampMs = replay.getReplay().startedAt.getTime();
  const crumbs = replay.getRawCrumbs();
  const userCrumbs = crumbs.filter(crumb => USER_ACTIONS.includes(crumb.type));
  const networkSpans = replay.getNetworkSpans();

  return (
    <Panel>
      <ScrubberMouseTracking>
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
              <UnderTimestamp paddingTop="0">
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
      </ScrubberMouseTracking>
    </Panel>
  );
}

const UnderTimestamp = styled('div')<{paddingTop: string}>`
  /* Weird size to put equal space above/below a <small> node that MajorGridlines emits */
  padding-top: ${p => p.paddingTop};
`;

export default ReplayTimeline;
