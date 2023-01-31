import {useState} from 'react';

import {Project, SessionApiResponse, SessionFieldWithOperation} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import {getCount} from 'sentry/utils/sessions';
import useOrganization from 'sentry/utils/useOrganization';

const DEFAULT_POLL_INTERVAL = 5000;

type Props = {
  project?: Project;
};

export function useHeartbeat({project}: Props) {
  const organization = useOrganization();
  const [firstErrorReceived, setFirstErrorReceived] = useState(false);
  const [firstTransactionReceived, setFirstTransactionReceived] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const {isLoading: eventLoading} = useQuery<Project>(
    [`/projects/${organization.slug}/${project?.slug}/`],
    {
      staleTime: 0,
      refetchInterval: DEFAULT_POLL_INTERVAL,
      enabled: !!project && !firstErrorReceived, // Fetch only if the project is available and we have not yet received an error,
      onSuccess: data => {
        setFirstErrorReceived(!!data.firstEvent);
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

  return {
    hasSession,
    firstErrorReceived,
    firstTransactionReceived,
    eventLoading,
    sessionLoading,
  };
}
