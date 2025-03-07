import {
  useApiQuery,
  type UseApiQueryOptions,
  useMutation,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

interface AssistantResult {
  guide: string;
  seen: boolean;
}

export function useAssistant(
  options: Partial<UseApiQueryOptions<AssistantResult[]>> = {}
) {
  return useApiQuery<AssistantResult[]>(['/assistant/'], {
    staleTime: Infinity,
    ...options,
  });
}

interface MutateAssistantData {
  guide: string;
  status: 'viewed' | 'dismissed' | 'restart';
  useful?: boolean;
}

interface UseMutateAssistantProps {
  onError?: (error: RequestError) => void;
  onSuccess?: () => void;
}

export function useMutateAssistant({onSuccess, onError}: UseMutateAssistantProps = {}) {
  const api = useApi({persistInFlight: false});
  return useMutation<AssistantResult[], RequestError, MutateAssistantData>({
    mutationFn: (data: MutateAssistantData) => {
      return api.requestPromise('/assistant/', {method: 'PUT', data});
    },
    onMutate: (_data: MutateAssistantData) => onSuccess?.(),
    onError: (error: RequestError) => onError?.(error),
  });
}
