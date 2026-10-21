import {useMemo} from 'react';

import {TimeSince} from 'sentry/components/timeSince';
import {GroupActivityType, type Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Timeline} from 'sentry/views/issueDetails/activitySection/timeline';

import type {ActivityFeedItem} from './activityFeedItem';
import {getActivityItem} from './activityItem';
import {ActivityLineHeadline} from './layout';
import {ActivityLineMarker} from './marker';

interface ActivityLineProps {
  group: Group;
  item: ActivityFeedItem;
  children?: React.ReactNode;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function ActivityLine({
  item,
  group,
  children,
  timestampUnitStyle,
}: ActivityLineProps) {
  const organization = useOrganization();
  const {issueCategory, project} = group;
  const {activity} = item;
  const activityItem = useMemo(
    () =>
      getActivityItem({
        item,
        organization,
        project,
        issueCategory,
      }),
    [item, issueCategory, organization, project]
  );
  const timestamp = (
    <TimeSince date={activity.dateCreated} unitStyle={timestampUnitStyle} />
  );
  let actorActivity = activity;
  if (item.type === GroupActivityType.SEER_ITERATION_COMPLETED) {
    actorActivity = item.startedActivity;
  } else if (item.type === 'activity' && item.actorActivity) {
    actorActivity = item.actorActivity;
  }

  return (
    <Timeline.Item
      marker={<ActivityLineMarker item={actorActivity} />}
      headline={
        <ActivityLineHeadline
          title={activityItem.title}
          details={activityItem.details}
          source={activityItem.source}
          timestamp={timestamp}
        />
      }
    >
      {children}
    </Timeline.Item>
  );
}
