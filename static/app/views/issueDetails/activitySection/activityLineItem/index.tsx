import {useMemo} from 'react';

import {TimeSince} from 'sentry/components/timeSince';
import {GroupActivityType, type Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ActivityFeedItem} from './activityFeedItem';
import {ActivityLineBody} from './body';
import {getCompactGroupActivityItem} from './compactActivityItem';
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
  const compactItem = useMemo(
    () =>
      getCompactGroupActivityItem({
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
  const actorActivity =
    item.type === GroupActivityType.SEER_ITERATION_COMPLETED
      ? item.startedActivity
      : activity;

  return (
    <ActivityLineRow>
      <ActivityLineMarker
        actorItem={actorActivity}
        item={activity}
        showProgress={showProgress}
      />
      <ActivityLineHeadline
        title={compactItem.title}
        details={compactItem.details}
        timestamp={timestamp}
      />
      <ActivityLineBody subtext={compactItem.subtext} />
    </ActivityLineRow>
  );
}
