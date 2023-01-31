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

export function useHeartbeat(
  projectSlug: string | undefined,
  projectId: string | undefined
) {
  const organization = useOrganization();

  const [firstError, setFirstError] = useState<string | null>(null);
  const [firstTransactionReceived, setFirstTransactionReceived] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [firstIssue, setFirstIssue] = useState<Group | undefined>(undefined);

  const serverConnected = hasSession || firstTransactionReceived;

  const {isLoading: eventIsLoading} = useQuery<Project>(
    [`/projects/${organization.slug}/${projectSlug}/`],
    {
      staleTime: 0,
      refetchInterval: DEFAULT_POLL_INTERVAL,
      enabled: !!projectSlug && !firstError, // Fetch only if the project is available and we have not yet received an error,
      onSuccess: data => {
        setFirstError(data.firstEvent);
        // When an error is received, a transaction is also received
        setFirstTransactionReceived(!!data.firstTransactionEvent);
      },
    }
  );

  const {isLoading: sessionIsLoading} = useQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          project: projectId,
          statsPeriod: '24h',
          field: [SessionFieldWithOperation.SESSIONS],
        },
      },
    ],
    {
      staleTime: 0,
      refetchInterval: DEFAULT_POLL_INTERVAL,
      enabled: !!projectId && !serverConnected, // Fetch only if the project is available and we if a connection to Sentry was not yet established,
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
  useQuery<Group[]>([`/projects/${organization.slug}/${projectSlug}/issues/`], {
    staleTime: 0,
    enabled: !!firstError && !firstIssue, // Only fetch if an error event is received and we have not yet located the first issue,
    onSuccess: data => {
      setFirstIssue(data.find((issue: Group) => issue.firstSeen === firstError));
    },
  });

  const firstErrorReceived = firstIssue ?? !!firstError;
  const loading = eventIsLoading || sessionIsLoading;

  return {
    loading,
    serverConnected,
    firstErrorReceived,
  };
}
