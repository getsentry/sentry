import React from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {
  MajorGridlines,
  MinorGridlines,
} from 'sentry/components/replays/breadcrumbs/gridlines';
import ReplayTimelineEvents from 'sentry/components/replays/breadcrumbs/replayTimelineEvents';
import ReplayTimelineSpans from 'sentry/components/replays/breadcrumbs/replayTimelineSpans';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import HorizontalMouseTracking from 'sentry/components/replays/player/horizontalMouseTracking';
import {TimelineScubber} from 'sentry/components/replays/player/scrubber';
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
  const {currentHoverTime, currentTime, duration, replay} = useReplayContext();

  if (!replay) {
    return <Placeholder height="86px" bottomGutter={2} />;
  }

  const crumbs = replay.getRawCrumbs() || [];
  const spans = replay.getRawSpans() || [];
  const transformedCrumbs = transformCrumbs(crumbs);
  const userCrumbs = transformedCrumbs.filter(crumb => USER_ACTIONS.includes(crumb.type));

  const networkSpans = spans.filter(replay.isNotMemorySpan);

  return (
    <Panel>
      <HorizontalMouseTracking>
        <Resizeable>
          {({width}) => (
            <Stacked>
              <MinorGridlines duration={duration || 0} width={width} />
              <MajorGridlines duration={duration || 0} width={width} />
              <StackedUnderTimestamp>
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
                <div>
                  <TimelineScubber />
                  <ReplayTimelineEvents
                    crumbs={userCrumbs}
                    duration={duration || 0}
                    startTimestamp={replay.getEvent().startTimestamp}
                    width={width}
                  />
                  <ReplayTimelineSpans
                    duration={duration || 0}
                    spans={networkSpans}
                    startTimestamp={replay.getEvent().startTimestamp}
                  />
                </div>
              </StackedUnderTimestamp>
            </Stacked>
          )}
        </Resizeable>
      </HorizontalMouseTracking>
    </Panel>
  );
}

const StackedUnderTimestamp = styled(Stacked)`
  /* Weird size to put equal space above/below a <small> node that MajorGridlines emits */
  padding-top: 24px;
`;

export default ReplayTimeline;
