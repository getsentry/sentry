import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export type ResultMode = 'samples' | 'aggregate';

export function useResultMode(): [ResultMode, (newMode: ResultMode) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useResultModeImpl(options);
}

function useResultModeImpl({
  location,
  navigate,
}: Options): [ResultMode, (newMode: ResultMode) => void] {
  const resultMode: ResultMode = useMemo(() => {
    const rawMode = decodeScalar(location.query.mode);
    if (rawMode === 'aggregate') {
      return 'aggregate' as const;
    }
    return 'samples' as const;
  }, [location.query.mode]);

  const setResultMode = useCallback(
    (newMode: ResultMode) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          mode: newMode,
        },
      });
    },
    [location, navigate]
  );

  return [resultMode, setResultMode];
}
