import {useCallback, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export function useQueryParamState(
  fieldName: string
): [string | undefined, (newField: string | undefined) => void] {
  const navigate = useNavigate();
  const location = useLocation();

  // The URL query params give us our initial state
  const parsedQueryParams = useLocationQuery({
    fields: {
      [fieldName]: decodeScalar,
    },
  });
  const [localState, setLocalState] = useState<string | undefined>(
    parsedQueryParams[fieldName]
  );

  // Debounce the update to the URL query params
  // to avoid unnecessary re-renders
  const updateQueryParam = useMemo(
    () =>
      debounce((newField: string | undefined) => {
        navigate({
          ...location,
          query: {...location.query, [fieldName]: newField},
        });
      }, DEFAULT_DEBOUNCE_DURATION),
    [location, navigate, fieldName]
  );

  const updateField = useCallback(
    (newField: string | undefined) => {
      setLocalState(newField);
      updateQueryParam(newField);
    },
    [updateQueryParam]
  );

  return [localState, updateField];
}
