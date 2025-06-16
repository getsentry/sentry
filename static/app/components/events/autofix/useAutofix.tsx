import {useCallback, useMemo, useState} from 'react';

import {
  type AutofixData,
  AutofixStatus,
  AutofixStepType,
  type GroupWithAutofix,
} from 'sentry/components/events/autofix/types';
import type {Event} from 'sentry/types/event';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  type UseApiQueryOptions,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export type AutofixResponse = {
  autofix: AutofixData | null;
};

const POLL_INTERVAL = 500;

export const makeAutofixQueryKey = (
  orgSlug: string,
  groupId: string,
  isUserWatching = false
): ApiQueryKey => [
  `/organizations/${orgSlug}/issues/${groupId}/autofix/`,
  {query: {isUserWatching: isUserWatching ? true : false}},
];

const makeInitialAutofixData = (): AutofixResponse => ({
  autofix: {
    status: AutofixStatus.PROCESSING,
    run_id: '',
    steps: [
      {
        type: AutofixStepType.DEFAULT,
        id: '1',
        index: 0,
        status: AutofixStatus.PROCESSING,
        title: 'Starting Autofix...',
        insights: [],
        progress: [
          {
            message: 'Ingesting Sentry data...',
            timestamp: new Date().toISOString(),
            type: 'INFO',
          },
        ],
      },
    ],
    last_triggered_at: new Date().toISOString(),
    request: {
      repos: [],
    },
    codebases: {},
  },
});

const makeErrorAutofixData = (errorMessage: string): AutofixResponse => {
  const data = makeInitialAutofixData();

  if (data.autofix) {
    data.autofix.status = AutofixStatus.ERROR;
    data.autofix.steps = [
      {
        type: AutofixStepType.DEFAULT,
        id: '1',
        index: 0,
        status: AutofixStatus.ERROR,
        title: 'Something went wrong',
        completedMessage: errorMessage,
        insights: [],
        progress: [],
      },
    ];
  }

  return data;
};

/** Will not poll when the autofix is in an error state or has completed */
const isPolling = (
  autofixData: AutofixData | null,
  runStarted: boolean,
  isSidebar?: boolean
) => {
  if (!autofixData && !runStarted) {
    return false;
  }

  if (!autofixData?.steps) {
    return true;
  }

  if (
    autofixData.status === AutofixStatus.PROCESSING ||
    autofixData?.steps.some(step => step.status === AutofixStatus.PROCESSING)
  ) {
    return true;
  }

  // Check if there's any active comment thread that hasn't been completed
  const hasActiveCommentThread = autofixData.steps.some(
    step =>
      (step.active_comment_thread && !step.active_comment_thread.is_completed) ||
      (step.agent_comment_thread && !step.agent_comment_thread.is_completed)
  );

  const hasSolutionStep = autofixData.steps.some(
    step => step.type === AutofixStepType.SOLUTION
  );

  if (
    !hasSolutionStep &&
    ![AutofixStatus.ERROR, AutofixStatus.CANCELLED].includes(autofixData.status)
  ) {
    // we want to keep polling until we have a solution step because that's a stopping point
    // we need this explicit check in case we get a state for a fraction of a second where the root cause is complete and there is no step after it started
    return true;
  }

  // Continue polling if there's an active comment thread, even if the run is completed
  if (!isSidebar && hasActiveCommentThread) {
    return true;
  }

  return (
    !autofixData ||
    ![
      AutofixStatus.ERROR,
      AutofixStatus.COMPLETED,
      AutofixStatus.CANCELLED,
      AutofixStatus.NEED_MORE_INFORMATION,
    ].includes(autofixData.status)
  );
};

export const useAutofixRepos = (groupId: string) => {
  const {data} = useAutofixData({groupId, isUserWatching: true});

  return useMemo(() => {
    const repos = data?.request?.repos ?? [];
    const codebases = data?.codebases ?? {};

    return {
      repos: repos.map(repo => ({
        ...repo,
        is_readable: codebases[repo.external_id]?.is_readable,
        is_writeable: codebases[repo.external_id]?.is_writeable,
      })),
      codebases,
    };
  }, [data]);
};

export const useAutofixData = ({
  groupId,
  isUserWatching = false,
}: {
  groupId: string;
  isUserWatching?: boolean;
}) => {
  const orgSlug = useOrganization().slug;

  const {data, isPending} = useApiQuery<AutofixResponse>(
    makeAutofixQueryKey(orgSlug, groupId, isUserWatching),
    {
      staleTime: Infinity,
      enabled: false,
      notifyOnChangeProps: ['data'],
    }
  );

  return {data: data?.autofix ?? null, isPending};
};

export const useAiAutofix = (
  group: GroupWithAutofix,
  event: Event,
  options: {
    isSidebar?: boolean;
    pollInterval?: number;
  } = {}
) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;
  const isUserWatching = !options.isSidebar;

  const [isReset, setIsReset] = useState<boolean>(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [waitingForNextRun, setWaitingForNextRun] = useState<boolean>(false);

  const {data: apiData, isPending} = useApiQuery<AutofixResponse>(
    makeAutofixQueryKey(orgSlug, group.id, isUserWatching),
    {
      staleTime: 0,
      retry: false,
      refetchInterval: query => {
        if (
          isPolling(
            query.state.data?.[0]?.autofix || null,
            !!currentRunId || waitingForNextRun,
            options.isSidebar
          )
        ) {
          return options.pollInterval ?? POLL_INTERVAL;
        }
        return false;
      },
    } as UseApiQueryOptions<AutofixResponse, RequestError>
  );

  const triggerAutofix = useCallback(
    async (instruction: string) => {
      setIsReset(false);
      setCurrentRunId(null);
      setWaitingForNextRun(true);
      setApiQueryData<AutofixResponse>(
        queryClient,
        makeAutofixQueryKey(orgSlug, group.id, isUserWatching),
        makeInitialAutofixData()
      );

      try {
        const response = await api.requestPromise(
          `/organizations/${orgSlug}/issues/${group.id}/autofix/`,
          {
            method: 'POST',
            data: {
              event_id: event.id,
              instruction,
            },
          }
        );
        setCurrentRunId(response.run_id ?? null);
        queryClient.invalidateQueries({
          queryKey: makeAutofixQueryKey(orgSlug, group.id, isUserWatching),
        });
      } catch (e) {
        setWaitingForNextRun(false);
        setApiQueryData<AutofixResponse>(
          queryClient,
          makeAutofixQueryKey(orgSlug, group.id, isUserWatching),
          makeErrorAutofixData(e?.responseJSON?.detail ?? 'An error occurred')
        );
      }
    },
    [queryClient, group.id, api, event.id, orgSlug, isUserWatching]
  );

  const reset = useCallback(() => {
    setIsReset(true);
    setCurrentRunId(null);
    setWaitingForNextRun(true);
  }, []);

  let autofixData = apiData?.autofix ?? null;
  if (waitingForNextRun) {
    autofixData = makeInitialAutofixData().autofix;
  }
  if (isReset) {
    autofixData = null;
  }

  if (
    apiData?.autofix?.steps?.length &&
    apiData?.autofix?.steps[0]?.progress.length &&
    waitingForNextRun &&
    apiData?.autofix?.run_id === currentRunId
  ) {
    setWaitingForNextRun(false);
  }

  return {
    autofixData,
    isPolling: isPolling(autofixData, !!currentRunId || waitingForNextRun),
    isPending,
    triggerAutofix,
    reset,
  };
};
