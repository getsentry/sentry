import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import type {TagCollection} from 'sentry/types/group';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';

import {useSpanTags} from '../contexts/spanTagsContext';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
  tags: TagCollection;
}

export function useGroupBys(): [Field[], (fields: Field[]) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const tags = useSpanTags();
  const options = {location, navigate, tags};

  return useGroupBysImpl(options);
}

function useGroupBysImpl({
  location,
  navigate,
  tags,
}: Options): [Field[], (fields: Field[]) => void] {
  const groupBys = useMemo(() => {
    const rawGroupBys = decodeList(location.query.groupBy);

    // Filter out groupBys that are not in span field supported tags
    const validGroupBys = rawGroupBys.filter(
      groupBy => groupBy === '' || tags.hasOwnProperty(groupBy)
    );

    if (validGroupBys.length) {
      return validGroupBys;
    }

    return [''];
  }, [location.query.groupBy, tags]);

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
