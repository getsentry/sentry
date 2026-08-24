import {useMemo} from 'react';

import {TimeSince} from 'sentry/components/timeSince';
import {GroupActivityType, type Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ActivityFeedItem} from './activityFeedItem';
import {getActivityItem} from './activityItem';
import {ActivityLineHeadline, ActivityLineRow} from './layout';
import {ActivityLineMarker} from './progressMarker';

interface ActivityLineProps {
  group: Group;
  item: ActivityFeedItem;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function ActivityLine({item, group, timestampUnitStyle}: ActivityLineProps) {
  const organization = useOrganization();
  const showProgress = organization.features.includes('issue-activity-progress');
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
    <ActivityLineRow>
      <ActivityLineMarker
        actorItem={actorActivity}
        item={activity}
        showProgress={showProgress}
      />
      <ActivityLineHeadline
        title={activityItem.title}
        details={activityItem.details}
        source={activityItem.source}
        timestamp={timestamp}
      />
    </ActivityLineRow>
  );
}
