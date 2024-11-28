import {useCallback, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface UseQueryParamStateProps<T> {
  fieldName: string;
  decoder?: (value: string) => T;
}

/**
 * Hook to manage a state that is synced with a query param in the URL
 *
 * @param fieldName - The name of the query param to sync with the state
 * @param decoder - A function to decode the query param value into the desired type
 * @returns A tuple containing the current state and a function to update the state
 */
export function useQueryParamState<T = string>({
  fieldName,
  decoder,
}: UseQueryParamStateProps<T>): [T | undefined, (newField: T | undefined) => void] {
  const navigate = useNavigate();
  const location = useLocation();

  // The URL query params give us our initial state
  const parsedQueryParams = useLocationQuery({
    fields: {
      [fieldName]: decodeScalar,
    },
  });
  const [localState, setLocalState] = useState<T | undefined>(() => {
    return decoder
      ? decoder(parsedQueryParams[fieldName])
      : // TODO(nar): This is a temporary fix to avoid type errors
        // When the decoder isn't provided, we should return the value
        // if T is a string, or else return undefined
        (parsedQueryParams[fieldName] as T);
  });

  // Debounce the update to the URL query params
  // to avoid unnecessary re-renders
  const updateQueryParam = useMemo(
    () =>
      debounce((newField: T | undefined) => {
        navigate({
          ...location,
          query: {...location.query, [fieldName]: newField},
        });
      }, DEFAULT_DEBOUNCE_DURATION),
    [location, navigate, fieldName]
  );

  const updateField = useCallback(
    (newField: T | undefined) => {
      setLocalState(newField);
      updateQueryParam(newField);
    },
    [updateQueryParam]
  );

  return [localState, updateField];
}
