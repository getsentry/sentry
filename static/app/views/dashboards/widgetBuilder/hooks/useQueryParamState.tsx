import {useCallback, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import debounce from 'lodash/debounce';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {defined} from 'sentry/utils';
import {type decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface UseQueryParamStateWithScalarDecoder<T> {
  fieldName: string;
  decoder?: typeof decodeScalar;
  deserializer?: (value: ReturnType<typeof decodeScalar>) => T;
  serializer?: (value: T) => string;
}

interface UseQueryParamStateWithListDecoder<T> {
  decoder: typeof decodeList;
  fieldName: string;
  deserializer?: (value: ReturnType<typeof decodeList>) => T;
  serializer?: (value: T) => string[];
}

type UseQueryParamStateProps<T> =
  | UseQueryParamStateWithScalarDecoder<T>
  | UseQueryParamStateWithListDecoder<T>;

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
  const navigate = useNavigate();
  const location = useLocation();

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

  // Debounce the update to the URL query params
  // to avoid unnecessary re-renders
  const updateQueryParam = useMemo(
    () =>
      debounce((newURLParamValues: string | string[] | undefined) => {
        navigate({
          ...location,
          query: {...location.query, [fieldName]: newURLParamValues},
        });
      }, DEFAULT_DEBOUNCE_DURATION),
    [location, navigate, fieldName]
  );

  const updateField = useCallback(
    (newField: T | undefined) => {
      setLocalState(newField);

      if (!defined(newField)) {
        updateQueryParam(undefined);
      } else if (serializer) {
        updateQueryParam(serializer(newField));
      } else {
        // At this point, only update the query param if the new field is a string, number, boolean, or array
        if (
          ['string', 'number', 'boolean'].includes(typeof newField) ||
          Array.isArray(newField)
        ) {
          updateQueryParam(newField as any);
        } else {
          Sentry.captureException(
            new Error(
              'useQueryParamState: newField is not a primitive value and not provided a serializer'
            )
          );
          updateQueryParam(undefined);
        }
      }
    },
    [updateQueryParam, serializer]
  );

  return [localState, updateField];
}
