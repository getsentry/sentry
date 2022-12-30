import {
  Group,
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

  const {data: eventData, isLoading: eventLoading} = useQuery<Project>(
    [`/projects/${organization.slug}/${project?.slug}/`],
    {
      staleTime: 0,
      refetchInterval: DEFAULT_POLL_INTERVAL,
      enabled: !!project, // Only fetch if project is available,
    }
  );

  // TODO(Priscila): Check if the query parameters are optimal
  const {data: sessionData, isLoading: sessionLoading} = useQuery<SessionApiResponse>(
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
      enabled: !!project, // Only fetch if project is available,
    }
  );

  // According to the docs https://develop.sentry.dev/sdk/sessions/#terminal-session-states, asession can exist in two states: in progress or terminated.
  // A terminated session must not receive further updates. 'exited', 'crashed' and 'abnormal' are all terminal states.
  const [inProgressState, terminatedStates] = sessionData
    ? partition(
        sessionData.groups,
        group => group.by['session.status'] === SessionStatus.HEALTHY
      )
    : [[], []];

  // TODO(Priscila): Is the exit state the same as the errored?
  const sessionTerminated = terminatedStates.some(
    terminateState => terminateState.totals['sum(session)'] > 0
  );

  const sessionInProgress =
    !sessionTerminated && inProgressState[0]?.totals['sum(session)'] > 0;

  // Locate the projects first issue group. The project.firstEvent field will
  // *not* include sample events, while just looking at the issues list will.
  // We will wait until the project.firstEvent is set and then locate the
  // event given that event datetime
  const {data: issuesData, isLoading: issuesLoading} = useQuery<Group[]>(
    [`/projects/${organization.slug}/${project?.slug}/issues/`],
    {
      staleTime: Infinity,
      enabled: !!eventData?.firstEvent, // Only fetch if firsEvent (issue) is available,
    }
  );

  const firstErrorReceived =
    eventData?.firstEvent && issuesData
      ? issuesData.find((issue: Group) => issue.firstSeen === eventData.firstEvent) ||
        true
      : false;

  const firstTransactionReceived = !!eventData?.firstTransactionEvent;

  return {
    sessionInProgress,
    firstErrorReceived,
    firstTransactionReceived,
    eventLoading,
    sessionLoading,
    issuesLoading,
  };
}
