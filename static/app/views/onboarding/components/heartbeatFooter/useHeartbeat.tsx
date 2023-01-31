import {useState} from 'react';

import {
  Group,
  Project,
  SessionApiResponse,
  SessionFieldWithOperation,
} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import {getCount} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';

const DEFAULT_POLL_INTERVAL = 5000;

type Props = {
  project?: Project;
};

export function useHeartbeat({project}: Props) {
  const organization = useOrganization();
  const [firstError, setFirstError] = useState<string | null>(null);
  const [firstTransactionReceived, setFirstTransactionReceived] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const {isLoading: eventLoading} = useQuery<Project>(
    [`/projects/${organization.slug}/${project?.slug}/`],
    {
      staleTime: 0,
      refetchInterval: DEFAULT_POLL_INTERVAL,
      enabled: !!project && !firstError, // Fetch only if the project is available and we have not yet received an error,
      onSuccess: data => {
        setFirstError(data.firstEvent);
        // When an error is received, a transaction is also received
        setFirstTransactionReceived(!!data.firstTransactionEvent);
      },
    }
  );

  const {isLoading: sessionLoading} = useQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          project: project?.id,
          statsPeriod: '24h',
          field: [SessionFieldWithOperation.SESSIONS],
        },
      },
    ],
    {
      staleTime: 0,
      refetchInterval: DEFAULT_POLL_INTERVAL,
      enabled: !!project && !(hasSession || firstTransactionReceived), // Fetch only if the project is available and we if a connection to Sentry was not yet established,
      onSuccess: data => {
        const hasHealthData =
          getCount(data.groups, SessionFieldWithOperation.SESSIONS) > 0;

        setHasSession(hasHealthData);
      },
    }
  );

  // Locate the projects first issue group. The project.firstEvent field will
  // *not* include sample events, while just looking at the issues list will.
  // We will wait until the project.firstEvent is set and then locate the
  // event given that event datetime
  const {data: issuesData, isLoading: issuesLoading} = useQuery<Group[]>(
    [`/projects/${organization.slug}/${project?.slug}/issues/`],
    {
      staleTime: Infinity,
      enabled: !!firstError, // Only fetch if an error event is received,
    }
  );

  const firstErrorReceived =
    !!firstError && issuesData
      ? issuesData.find((issue: Group) => issue.firstSeen === firstError) || true
      : false;

  return {
    hasSession,
    firstErrorReceived,
    firstTransactionReceived,
    eventLoading,
    sessionLoading,
    issuesLoading,
  };
}
