import {useCallback, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {type IssueType, PriorityLevel} from 'sentry/types/group';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GroupPriorityControl} from 'sentry/views/issueDetails/groupPriority';

interface OverviewIssuePriorityProps {
  groupId: string;
  issueType: IssueType;
  priority: PriorityLevel | null;
  priorityLockedAt: string | null;
  projectId: string;
}

export function OverviewIssuePriority({
  groupId,
  issueType,
  priority,
  priorityLockedAt,
  projectId,
}: OverviewIssuePriorityProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const issueIndexUrl = getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  const [priorityOverride, setPriorityOverride] = useState<{
    groupId: string;
    priority: PriorityLevel;
  } | null>(null);

  const currentPriority =
    priorityOverride?.groupId === groupId
      ? priorityOverride.priority
      : (priority ?? PriorityLevel.MEDIUM);

  const handleSuccess = useCallback(
    (nextPriority: PriorityLevel) => {
      setPriorityOverride({groupId, priority: nextPriority});
      void queryClient.invalidateQueries({queryKey: [issueIndexUrl]});
    },
    [groupId, issueIndexUrl, queryClient]
  );

  return (
    <GroupPriorityControl
      groupId={groupId}
      issueType={issueType}
      priority={currentPriority}
      priorityLockedAt={priorityLockedAt}
      projectId={projectId}
      onChange={handleSuccess}
    />
  );
}
