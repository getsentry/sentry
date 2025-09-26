import {useCallback, useMemo} from 'react';

import {decodeBoolean} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export function useCaseInsensitivity(): [boolean | undefined, (c: boolean) => void] {
  const navigate = useNavigate();
  const location = useLocation();

  const caseInsensitive = useMemo(
    () => decodeBoolean(location.query.caseInsensitive),
    [location]
  );

  const setCaseInsensitive = useCallback(
    (c: boolean) =>
      navigate({...location, query: {...location.query, caseInsensitive: c}}),
    [location, navigate]
  );

  return [caseInsensitive, setCaseInsensitive];
}
