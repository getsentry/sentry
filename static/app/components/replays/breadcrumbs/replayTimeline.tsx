import React from 'react';
import styled from '@emotion/styled';

import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {
  MajorGridlines,
  MinorGridlines,
} from 'sentry/components/replays/breadcrumbs/gridlines';
import ReplayTimelineEvents from 'sentry/components/replays/breadcrumbs/replayTimelineEvents';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import HorizontalMouseTracking from 'sentry/components/replays/player/horizontalMouseTracking';
import {TimelineScubber} from 'sentry/components/replays/player/scrubber';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Resizeable} from 'sentry/components/replays/resizeable';
import TimelinePosition from 'sentry/components/replays/timelinePosition';
import space from 'sentry/styles/space';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';

type Props = {};

const USER_ACTIONS = [
  BreadcrumbType.ERROR,
  BreadcrumbType.NAVIGATION,
  BreadcrumbType.UI,
  BreadcrumbType.USER,
];

function ReplayTimeline({}: Props) {
  const {currentTime, duration, replay} = useReplayContext();
  const crumbs = replay?.getRawCrumbs() || [];
  const transformedCrumbs = transformCrumbs(crumbs);
  const userCrumbs = transformedCrumbs.filter(crumb => USER_ACTIONS.includes(crumb.type));

  return (
    <HorizontalMouseTracking>
      <TimelineScubber />
      <Resizeable>
        {({width}) => (
          <Stacked>
            <MinorGridlines duration={duration || 0} width={width} />
            <MajorGridlines duration={duration || 0} width={width} />
            <TimelinePosition currentTime={currentTime} duration={duration} />
            <OffsetEvents crumbs={userCrumbs} width={width} />
          </Stacked>
        )}
      </Resizeable>
    </HorizontalMouseTracking>
  );
}

const OffsetEvents = styled(ReplayTimelineEvents)`
  padding-top: ${space(4)};
`;

export default ReplayTimeline;
