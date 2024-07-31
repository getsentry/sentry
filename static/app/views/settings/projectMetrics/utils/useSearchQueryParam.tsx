import {useMemo} from 'react';
import debounce from 'lodash/debounce';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export function useSearchQueryParam(key: string) {
  const location = useLocation();
  const navigate = useNavigate();

  const query = decodeScalar(location.query[key], '').trim();

  const setQuery = useMemo(
    () =>
      debounce(
        (searchQuery: string) =>
          navigate({
            pathname: location.pathname,
            query: {...location.query, [key]: searchQuery || undefined},
          }),
        DEFAULT_DEBOUNCE_DURATION
      ),
    [location.pathname, location.query, navigate, key]
  );

  return [query, setQuery] as const;
}
