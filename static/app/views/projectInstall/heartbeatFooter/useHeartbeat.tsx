import {useState} from 'react';

import {
  Project,
  SessionApiResponse,
  SessionFieldWithOperation,
  SessionStatus,
} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const DEFAULT_POLL_INTERVAL = 5000;

import partition from 'lodash/partition';

type Props = {
  project?: Project;
};

export function useHeartbeat({project}: Props) {
  const organization = useOrganization();
  const [firstErrorReceived, setFirstErrorReceived] = useState(false);
  const [firstTransactionReceived, setFirstTransactionReceived] = useState(false);
  const [sessionInProgress, setSessionInProgress] = useState(false);

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

  // TODO(Priscila): Check if the query parameters are optimal
  const {isLoading: sessionLoading} = useQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          project: project?.id,
          groupBy: 'session.status',
          statsPeriod: '24h',
          interval: '1h',
          field: [SessionFieldWithOperation.SESSIONS],
        },
      },
    ],
    {
      staleTime: 0,
      refetchInterval: DEFAULT_POLL_INTERVAL,
      enabled: !!project && !(sessionInProgress || firstTransactionReceived), // Fetch only if the project is available and we if a connection to Sentry was not yet established,
      onSuccess: data => {
        // According to the docs https://develop.sentry.dev/sdk/sessions/#terminal-session-states, a session can exist in two states: in progress or terminated.
        // A terminated session must not receive further updates. 'exited', 'crashed' and 'abnormal' are all terminal states.
        const [inProgressState, terminatedStates] = partition(
          data.groups,
          group => group.by['session.status'] === SessionStatus.HEALTHY
        );

        // TODO(Priscila): Is the exit state the same as the errored?
        const sessionTerminated = terminatedStates.some(
          terminateState => terminateState.totals['sum(session)'] > 0
        );

        setSessionInProgress(
          !sessionTerminated && inProgressState[0]?.totals['sum(session)'] > 0
        );
      },
    }
  );

  return {
    sessionInProgress,
    firstErrorReceived,
    firstTransactionReceived,
    eventLoading,
    sessionLoading,
  };
}
