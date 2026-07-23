import {useCallback, useMemo, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import {PriorityLevel} from 'sentry/types/group';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';

interface OverviewIssuePriorityProps {
  groupId: string;
  projectId: string;
  priority?: PriorityLevel;
}

export function OverviewIssuePriority({
  groupId,
  projectId,
  priority,
}: OverviewIssuePriorityProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const issueIndexUrl = getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  const [priorityOverride, setPriorityOverride] = useState<{
    groupId: OverviewIssuePriorityProps['groupId'];
    priority: PriorityLevel;
  } | null>(null);

  const currentPriority =
    priorityOverride?.groupId === groupId
      ? priorityOverride.priority
      : (priority ?? PriorityLevel.MEDIUM);

  const group = useMemo(
    () =>
      ({
        id: groupId,
        priority: currentPriority,
        project: {id: projectId},
      }) as Group,
    [currentPriority, groupId, projectId]
  );

  const handleSuccess = useCallback(
    (nextPriority: PriorityLevel) => {
      setPriorityOverride({groupId, priority: nextPriority});
      void queryClient.invalidateQueries({queryKey: [issueIndexUrl]});
    },
    [groupId, issueIndexUrl, queryClient]
  );

  return <GroupPriority group={group} onChange={handleSuccess} />;
}
