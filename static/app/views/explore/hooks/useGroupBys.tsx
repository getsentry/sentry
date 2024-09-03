import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export function useGroupBys(): [Field[], (fields: Field[]) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useGroupBysImpl(options);
}

function useGroupBysImpl({
  location,
  navigate,
}: Options): [Field[], (fields: Field[]) => void] {
  const groupBys = useMemo(() => {
    const rawGroupBys = decodeList(location.query.groupBy);

    if (rawGroupBys.length) {
      return rawGroupBys;
    }

    return [''];
  }, [location.query.groupBy]);

  const setGroupBys = useCallback(
    (newGroupBys: Field[]) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          groupBy: newGroupBys,
        },
      });
    },
    [location, navigate]
  );

  return [groupBys, setGroupBys];
}
