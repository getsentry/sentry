import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

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
  useful?: boolean;
}

// Matching the logic from src/sentry/api/endpoints/assistant.py
const seenStatuses = new Set(['viewed', 'dismissed']);

interface UseMutateAssistantProps {
  onError?: (error: RequestError) => void;
  onSuccess?: () => void;
}

export function useMutateAssistant({onSuccess, onError}: UseMutateAssistantProps = {}) {
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
    onSuccess: () => onSuccess?.(),
    onError: (error: RequestError) => onError?.(error),
  });
}
