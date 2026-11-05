import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useApi} from 'sentry/utils/useApi';

interface AssistantResult {
  guide: string;
  seen: boolean;
}

const assistantQueryOptions = apiOptions.as<AssistantResult[]>()('/assistant/', {
  staleTime: 30000,
});

export function useAssistant() {
  return useQuery(assistantQueryOptions);
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
