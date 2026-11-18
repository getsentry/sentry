import {QUERY_API_CLIENT} from './api/apiFetch';
import type {QueryKeyEndpointOptions} from './api/apiQueryKey';
import type {getApiUrl} from './api/getApiUrl';

type ApiMutationVariables = {
  method: 'PUT' | 'POST' | 'PATCH' | 'DELETE';
  url: ReturnType<typeof getApiUrl>;
  data?: Record<string, unknown>;
  options?: Pick<
    QueryKeyEndpointOptions,
    'includeAllArgs' | 'query' | 'headers' | 'host'
  >;
};

/**
 * This method can be used as a default `mutationFn` with `useMutation` hook.
 */
export function fetchMutation<TResponseData = unknown>(
  variables: ApiMutationVariables
): Promise<TResponseData> {
  const {method, url, options, data} = variables;

  return QUERY_API_CLIENT.requestPromise(url, {
    includeAllArgs: options?.includeAllArgs,
    method,
    query: options?.query,
    headers: options?.headers,
    host: options?.host,
    data,
  });
}
