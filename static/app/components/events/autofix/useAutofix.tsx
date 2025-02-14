import {useCallback, useState} from 'react';

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

export type AutofixResponse = {
  autofix: AutofixData | null;
};

const POLL_INTERVAL = 500;

export const makeAutofixQueryKey = (groupId: string): ApiQueryKey => [
  `/issues/${groupId}/autofix/`,
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
    created_at: new Date().toISOString(),
    repositories: [],
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
const isPolling = (autofixData?: AutofixData | null) => {
  if (!autofixData?.steps) {
    return true;
  }

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
  return (
    !autofixData ||
    ![AutofixStatus.ERROR, AutofixStatus.COMPLETED, AutofixStatus.CANCELLED].includes(
      autofixData.status
    )
  );
};

export const useAutofixData = ({groupId}: {groupId: string}) => {
  const {data} = useApiQuery<AutofixResponse>(makeAutofixQueryKey(groupId), {
    staleTime: Infinity,
    enabled: false,
    notifyOnChangeProps: ['data'],
  });

  return data?.autofix ?? null;
};

export const useAiAutofix = (group: GroupWithAutofix, event: Event) => {
  const api = useApi();
  const queryClient = useQueryClient();

  const [isReset, setIsReset] = useState<boolean>(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [waitingForNextRun, setWaitingForNextRun] = useState<boolean>(false);

  const {data: apiData} = useApiQuery<AutofixResponse>(makeAutofixQueryKey(group.id), {
    staleTime: 0,
    retry: false,
    refetchInterval: query => {
      if (isPolling(query.state.data?.[0]?.autofix)) {
        return POLL_INTERVAL;
      }
      return false;
    },
  } as UseApiQueryOptions<AutofixResponse, RequestError>);

  const triggerAutofix = useCallback(
    async (instruction: string) => {
      setIsReset(false);
      setCurrentRunId(null);
      setWaitingForNextRun(true);
      setApiQueryData<AutofixResponse>(
        queryClient,
        makeAutofixQueryKey(group.id),
        makeInitialAutofixData()
      );

      try {
        const response = await api.requestPromise(`/issues/${group.id}/autofix/`, {
          method: 'POST',
          data: {
            event_id: event.id,
            instruction,
          },
        });
        setCurrentRunId(response.run_id ?? null);
      } catch (e) {
        setApiQueryData<AutofixResponse>(
          queryClient,
          makeAutofixQueryKey(group.id),
          makeErrorAutofixData(e?.responseJSON?.detail ?? 'An error occurred')
        );
      }
    },
    [queryClient, group.id, api, event.id]
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
    isPolling: isPolling(autofixData),
    triggerAutofix,
    reset,
  };
};
