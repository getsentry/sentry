import {useCallback, useEffect, useMemo, useReducer} from 'react';

import type {ApiResult} from 'sentry/api';
import type {Organization} from 'sentry/types';
import type {RemoteConfig} from 'sentry/types/remoteConfig';
import replaceAtArrayIndex from 'sentry/utils/array/replaceAtArrayIndex';
import {
  type ApiQueryKey,
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

interface Props {
  organization: Organization;
  projectId: string;
}

const DEFAULT_CONFIG_VALUE: RemoteConfig = {
  data: {
    features: [],
    options: {
      sample_rate: 0,
      traces_sample_rate: 0,
    },
  },
};

function makeResponseValue(payload: RemoteConfig): ApiResult<RemoteConfig> {
  return [payload, '', undefined];
}

type DispatchAction =
  | {data: RemoteConfig; type: 'revertStaged'}
  | {key: string; type: 'updateOption'; value: string | number}
  | {key: string; type: 'addFeature'; value: string}
  | {key: string; type: 'updateFeature'; value: string}
  | {key: string; type: 'removeFeature'};

type TVariables = ['DELETE', undefined] | ['POST', RemoteConfig];
type TContext = unknown;

export default function useRemoteConfigSettings({organization, projectId}: Props) {
  const queryKey: ApiQueryKey = useMemo(
    () => [`/projects/${organization.slug}/${projectId}/configuration/`],
    [organization.slug, projectId]
  );

  const api = useApi({persistInFlight: false});
  const queryClient = useQueryClient();

  const fetchResult = useApiQuery(queryKey, {
    initialData: makeResponseValue(DEFAULT_CONFIG_VALUE),
    staleTime: 0,
    retry(failureCount: number, error: RequestError) {
      return failureCount < 3 && error.status !== 404;
    },
  });

  const [staged, dispatch] = useReducer(reducer, DEFAULT_CONFIG_VALUE);

  useEffect(() => {
    if (fetchResult.data) {
      dispatch({type: 'revertStaged', data: fetchResult.data});
    }
  }, [fetchResult.data]);

  const mutation = useMutation<RemoteConfig, RequestError, TVariables, TContext>({
    mutationFn([method, payload]) {
      return fetchMutation(api)([method, queryKey[0], {}, payload ?? {}]);
    },
    onMutate([_method, payload]) {
      queryClient.setQueryData(
        queryKey,
        makeResponseValue(payload ?? DEFAULT_CONFIG_VALUE)
      );
    },
  });

  const handleSave = useCallback(
    (onSuccess: () => void, onError: () => void) => {
      mutation.mutate(['POST', staged], {
        onSuccess(data, _variables, _context) {
          dispatch({type: 'revertStaged', data});
          onSuccess();
        },
        onError() {
          queryClient.invalidateQueries(queryKey);
          onError();
        },
      });
    },
    [mutation, queryClient, queryKey, staged]
  );

  const handleDelete = useCallback(
    (onSuccess: () => void, onError: () => void) => {
      mutation.mutate(['DELETE', undefined], {
        onSuccess(data, _variables, _context) {
          dispatch({type: 'revertStaged', data});
          onSuccess();
        },
        onError() {
          setApiQueryData(queryClient, queryKey, DEFAULT_CONFIG_VALUE);
          onError();
        },
      });
    },
    [mutation, queryClient, queryKey]
  );

  return {
    result: fetchResult,
    staged,
    dispatch,
    handleDelete,
    handleSave,
  };
}

function reducer(state: RemoteConfig, action: DispatchAction): RemoteConfig {
  switch (action.type) {
    case 'revertStaged':
      return action.data;

    case 'updateOption':
      return {
        data: {
          ...state.data,
          options: {
            ...state.data.options,
            [action.key]: action.value,
          },
        },
      };

    case 'addFeature':
      return {
        data: {
          ...state.data,
          features: [...state.data.features, {key: action.key, value: action.value}],
        },
      };

    case 'updateFeature': {
      const features = state.data.features || [];
      const index = features.findIndex(feature => feature.key === action.key);
      if (features.at(index)?.value === action.value) {
        return state;
      }

      return {
        data: {
          ...state.data,
          features: replaceAtArrayIndex(features, index, {
            key: action.key,
            value: action.value,
          }),
        },
      };
    }

    case 'removeFeature':
      return {
        data: {
          ...state.data,
          features: state.data.features.filter(feature => feature.key !== action.key),
        },
      };

    default:
      throw new Error(`Unexpected remote config action type`);
  }
}
