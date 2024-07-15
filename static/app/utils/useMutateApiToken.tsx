import type {InternalAppApiToken} from 'sentry/types/user';
import {
  getApiQueryData,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

const API_TOKEN_QUERY_KEY = ['/api-tokens/'] as const;

type UpdateTokenQueryVariables = {
  name: string;
};
type FetchApiTokenParameters = {
  tokenId: string;
};
export const makeFetchApiTokenKey = ({tokenId}: FetchApiTokenParameters) =>
  [`/api-tokens/${tokenId}/`] as const;

interface UseMutateApiTokenProps {
  token: InternalAppApiToken;
  onError?: (error: RequestError) => void;
  onSuccess?: () => void;
}

export default function useMutateApiToken({
  token,
  onSuccess,
  onError,
}: UseMutateApiTokenProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<{}, RequestError, UpdateTokenQueryVariables>({
    mutationFn: ({name}) =>
      api.requestPromise(`/api-tokens/${token.id}/`, {
        method: 'PUT',
        data: {
          name,
        },
      }),

    onSuccess: (_data, {name}) => {
      // Update get by id query
      setApiQueryData(
        queryClient,
        makeFetchApiTokenKey({tokenId: token.id}),
        (oldData: InternalAppApiToken | undefined) => {
          if (!oldData) {
            return oldData;
          }

          oldData.name = name;

          return oldData;
        }
      );

      // Update get list query
      if (getApiQueryData(queryClient, API_TOKEN_QUERY_KEY)) {
        setApiQueryData(
          queryClient,
          API_TOKEN_QUERY_KEY,
          (oldData: InternalAppApiToken[] | undefined) => {
            if (!Array.isArray(oldData)) {
              return oldData;
            }

            const existingToken = oldData.find(oldToken => oldToken.id === token.id);

            if (existingToken) {
              existingToken.name = name;
            }

            return oldData;
          }
        );
      }
      return onSuccess?.();
    },
    onError: error => {
      return onError?.(error);
    },
  });
}
