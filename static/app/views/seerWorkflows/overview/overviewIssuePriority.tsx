import {useCallback, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {PriorityLevel, type Group} from 'sentry/types/group';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';

export type OverviewIssuePriorityGroup = Pick<
  Group,
  | 'assignedTo'
  | 'count'
  | 'id'
  | 'issueCategory'
  | 'issueType'
  | 'lastSeen'
  | 'level'
  | 'owners'
  | 'priorityLockedAt'
> & {
  priority: PriorityLevel | null;
  project: Pick<Group['project'], 'id'>;
};

interface OverviewIssuePriorityProps {
  group: OverviewIssuePriorityGroup;
}

export function OverviewIssuePriority({group}: OverviewIssuePriorityProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const issueIndexUrl = getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  const [priorityOverride, setPriorityOverride] = useState<{
    groupId: OverviewIssuePriorityGroup['id'];
    priority: PriorityLevel;
  } | null>(null);

  const currentPriority =
    priorityOverride?.groupId === group.id
      ? priorityOverride.priority
      : (group.priority ?? PriorityLevel.MEDIUM);
  const currentGroup = {...group, priority: currentPriority} as Group;

  const handleSuccess = useCallback(
    (nextPriority: PriorityLevel) => {
      setPriorityOverride({groupId: group.id, priority: nextPriority});
      void queryClient.invalidateQueries({queryKey: [issueIndexUrl]});
    },
    [group.id, issueIndexUrl, queryClient]
  );

  return <GroupPriority group={currentGroup} onChange={handleSuccess} />;
}
