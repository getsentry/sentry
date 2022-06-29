import {useTheme} from '@emotion/react';
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
import {TimelineScubber} from 'sentry/components/replays/player/scrubber';
import ScrubberMouseTracking from 'sentry/components/replays/player/scrubberMouseTracking';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Resizeable} from 'sentry/components/replays/resizeable';
import TimelinePosition from 'sentry/components/replays/timelinePosition';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';

type Props = {};

const USER_ACTIONS = [
  BreadcrumbType.ERROR,
  BreadcrumbType.NAVIGATION,
  BreadcrumbType.UI,
  BreadcrumbType.USER,
];

function ReplayTimeline({}: Props) {
  const theme = useTheme();
  const {currentHoverTime, currentTime, duration = 0, replay} = useReplayContext();

  if (!replay) {
    return <Placeholder height="86px" bottomGutter={2} />;
  }

  const {startTimestamp} = replay.getEvent();
  const crumbs = replay.getRawCrumbs() || [];
  const spans = replay.getRawSpans() || [];
  const userCrumbs = crumbs.filter(crumb => USER_ACTIONS.includes(crumb.type));

  const networkSpans = spans.filter(replay.isNotMemorySpan);

  return (
    <Panel>
      <ScrubberMouseTracking>
        <Resizeable>
          {({width}) => (
            <Stacked>
              <MinorGridlines duration={duration} width={width} />
              <MajorGridlines duration={duration} width={width} />
              <TimelineScubber />
              <TimelinePosition
                color={theme.purple300}
                currentTime={currentTime}
                duration={duration}
              />
              {currentHoverTime ? (
                <TimelinePosition
                  color={theme.purple200}
                  currentTime={currentHoverTime}
                  duration={duration}
                />
              ) : null}
              <UnderTimestamp>
                <ReplayTimelineEvents
                  crumbs={userCrumbs}
                  duration={duration}
                  startTimestamp={startTimestamp}
                  width={width}
                />
                <ReplayTimelineSpans
                  duration={duration}
                  spans={networkSpans}
                  startTimestamp={startTimestamp}
                />
              </UnderTimestamp>
            </Stacked>
          )}
        </Resizeable>
      </ScrubberMouseTracking>
    </Panel>
  );
}

const UnderTimestamp = styled('div')`
  /* Weird size to put equal space above/below a <small> node that MajorGridlines emits */
  padding-top: 16px;
`;

export default ReplayTimeline;
