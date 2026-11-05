import type {UseQueryOptions} from '@tanstack/react-query';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {useApi} from 'sentry/utils/useApi';

interface AssistantResult {
  guide: string;
  seen: boolean;
}

const assistantQueryOptions = apiOptions.as<AssistantResult[]>()('/assistant/', {
  staleTime: 30000,
});

export function useAssistant(
  options: Omit<
    UseQueryOptions<
      ApiResponse<AssistantResult[]>,
      Error,
      AssistantResult[],
      ApiQueryKey
    >,
    'queryKey' | 'queryFn' | 'select'
  > = {}
) {
  return useQuery({
    ...assistantQueryOptions,
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

  return useMutation({
    mutationFn: (data: MutateAssistantData) => {
      return api.requestPromise('/assistant/', {method: 'PUT', data});
    },
    onMutate: ({guide, status}: MutateAssistantData) => {
      queryClient.setQueryData(assistantQueryOptions.queryKey, previous => ({
        ...previous,
        headers: previous?.headers ?? {},
        json: (previous?.json ?? []).map(result =>
          result.guide === guide ? {...result, seen: seenStatuses.has(status)} : result
        ),
      }));
    },
  });
}
