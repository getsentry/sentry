import {useCallback, useState} from 'react';
import * as Sentry from '@sentry/react';

import {defined} from 'sentry/utils';
import {type decodeList, decodeScalar, type decodeSorts} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

import {useUrlBatchContext} from '../contexts/urlParamBatchContext';

interface UseQueryParamStateWithScalarDecoder<T> {
  fieldName: string;
  decoder?: typeof decodeScalar;
  deserializer?: (value: ReturnType<typeof decodeScalar>) => T | undefined;
  serializer?: (value: T) => string;
}

interface UseQueryParamStateWithListDecoder<T> {
  decoder: typeof decodeList;
  fieldName: string;
  deserializer?: (value: ReturnType<typeof decodeList>) => T;
  serializer?: (value: T) => string[];
}

interface UseQueryParamStateWithSortsDecoder<T> {
  decoder: typeof decodeSorts;
  fieldName: string;
  serializer: (value: T) => string[];
  deserializer?: (value: ReturnType<typeof decodeSorts>) => T;
}

type UseQueryParamStateProps<T> =
  | UseQueryParamStateWithScalarDecoder<T>
  | UseQueryParamStateWithListDecoder<T>
  | UseQueryParamStateWithSortsDecoder<T>;

/**
 * Hook to manage a state that is synced with a query param in the URL
 *
 * @param fieldName - The name of the query param to sync with the state
 * @param deserializer - A function to transform the query param value into the desired type
 * @returns A tuple containing the current state and a function to update the state
 */
export function useQueryParamState<T = string>({
  fieldName,
  decoder,
  deserializer,
  serializer,
}: UseQueryParamStateProps<T>): [T | undefined, (newField: T | undefined) => void] {
  const {batchUrlParamUpdates} = useUrlBatchContext();

  // The URL query params give us our initial state
  const parsedQueryParams = useLocationQuery({
    fields: {
      [fieldName]: decoder ?? decodeScalar,
    },
  });
  const [localState, setLocalState] = useState<T | undefined>(() => {
    const decodedValue = parsedQueryParams[fieldName];

    if (!defined(decodedValue)) {
      return undefined;
    }

    return deserializer
      ? deserializer(decodedValue as any)
      : // TODO(nar): This is a temporary fix to avoid type errors
        // When the deserializer isn't provided, we should return the value
        // if T is a string, or else return undefined
        (decodedValue as T);
  });

  const updateField = useCallback(
    (newField: T | undefined) => {
      setLocalState(newField);

      if (!defined(newField)) {
        batchUrlParamUpdates({[fieldName]: undefined});
      } else if (serializer) {
        batchUrlParamUpdates({[fieldName]: serializer(newField)});
      } else {
        // At this point, only update the query param if the new field is a string, number, boolean, or array
        if (
          ['string', 'number', 'boolean'].includes(typeof newField) ||
          Array.isArray(newField)
        ) {
          batchUrlParamUpdates({[fieldName]: newField as any});
        } else {
          Sentry.captureException(
            new Error(
              'useQueryParamState: newField is not a primitive value and not provided a serializer'
            )
          );
          batchUrlParamUpdates({[fieldName]: undefined});
        }
      }
    },
    [batchUrlParamUpdates, serializer, fieldName]
  );

  return [localState, updateField];
}
