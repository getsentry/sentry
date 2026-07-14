import {useMemo} from 'react';

import {TimeSince} from 'sentry/components/timeSince';
import type {Group, GroupActivity} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ActivityLineActor} from './actor';
import {ActivityLineBody} from './body';
import {getCompactGroupActivityItem} from './compactActivityItem';
import {ActivityLineHeadline, ActivityLineRow} from './layout';
import {ActivityLineMarker} from './progressMarker';

interface ActivityLineProps {
  group: Group;
  item: GroupActivity;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}

export function ActivityLine({item, group, timestampUnitStyle}: ActivityLineProps) {
  const organization = useOrganization();
  const {issueCategory, project} = group;
  const compactItem = useMemo(
    () =>
      getCompactGroupActivityItem({
        activity: item,
        organization,
        project,
        issueCategory,
      }),
    [item, issueCategory, organization, project]
  );
  const timestamp = <TimeSince date={item.dateCreated} unitStyle={timestampUnitStyle} />;

  return (
    <ActivityLineRow>
      <ActivityLineMarker item={item} />
      <ActivityLineActor item={item} />
      <ActivityLineHeadline
        title={compactItem.title}
        details={compactItem.details}
        timestamp={timestamp}
      />
      <ActivityLineBody subtext={compactItem.subtext} />
    </ActivityLineRow>
  );
}
