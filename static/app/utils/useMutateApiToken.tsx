import type {InternalAppApiToken} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  getApiQueryData,
  setApiQueryData,
  useMutation,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

const API_TOKEN_QUERY_KEY: ApiQueryKey = [getApiUrl('/api-tokens/')];

type UpdateTokenQueryVariables = {
  name: string;
};
type FetchApiTokenParameters = {
  tokenId: string;
};
const makeFetchApiTokenKey = ({tokenId}: FetchApiTokenParameters): ApiQueryKey => [
  getApiUrl('/api-tokens/$tokenId/', {path: {tokenId}}),
];

interface UseMutateApiTokenProps {
  token: InternalAppApiToken;
  onError?: (error: RequestError) => void;
  onSuccess?: (token: InternalAppApiToken | undefined) => void;
}

export default function useMutateApiToken({
  token,
  onSuccess,
  onError,
}: UseMutateApiTokenProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation<unknown, RequestError, UpdateTokenQueryVariables>({
    mutationFn: ({name}) =>
      api.requestPromise(`/api-tokens/${token.id}/`, {
        method: 'PUT',
        data: {
          name,
        },
      }),

    onSuccess: (_data, {name}) => {
      // Update get by id query
      let updatedData: InternalAppApiToken | undefined = undefined;
      updatedData = setApiQueryData(
        queryClient,
        makeFetchApiTokenKey({tokenId: token.id}),
        (oldData?: InternalAppApiToken) => {
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
          (oldData?: InternalAppApiToken[]) => {
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
      return onSuccess?.(updatedData);
    },
    onError: error => {
      return onError?.(error);
    },
  });
}
