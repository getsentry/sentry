import {useMutation, useQueryClient} from '@tanstack/react-query';

import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  setApiQueryData,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';

interface AssistantResult {
  guide: string;
  seen: boolean;
}

const assistantQueryKey: ApiQueryKey = [getApiUrl('/assistant/')];

export function useAssistant(
  options: Partial<UseApiQueryOptions<AssistantResult[]>> = {}
) {
  return useApiQuery<AssistantResult[]>(assistantQueryKey, {
    staleTime: 30000,
    ...options,
  });
}

interface MutateAssistantData {
  guide: string;
  status: 'viewed' | 'dismissed' | 'restart';
}

// Matching the logic from src/sentry/api/endpoints/assistant.py
const seenStatuses = new Set(['viewed', 'dismissed']);

export function useMutateAssistant() {
  const api = useApi({persistInFlight: false});
  const queryClient = useQueryClient();

  return useMutation<unknown, RequestError, MutateAssistantData>({
    mutationFn: (data: MutateAssistantData) => {
      return api.requestPromise('/assistant/', {method: 'PUT', data});
    },
    onMutate: ({guide, status}: MutateAssistantData) => {
      setApiQueryData<AssistantResult[]>(
        queryClient,
        assistantQueryKey,
        (existingData = []) =>
          existingData.map(result =>
            result.guide === guide ? {...result, seen: seenStatuses.has(status)} : result
          )
      );
    },
  });
}
