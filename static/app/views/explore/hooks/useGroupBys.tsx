import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import type {TagCollection} from 'sentry/types/group';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';
import type {SpanFieldsResponse} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

import {useSpanTags} from '../contexts/spanTagsContext';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
  tagsResults: Omit<UseApiQueryResult<SpanFieldsResponse, RequestError>, 'data'> & {
    data: TagCollection;
  };
}

type GroupBysResult = {
  groupBys: Field[];
  isLoadingGroupBys: boolean;
  setGroupBys: (fields: Field[]) => void;
};

export function useGroupBys(): GroupBysResult {
  const location = useLocation();
  const navigate = useNavigate();
  const tagsResults = useSpanTags();
  const options = {location, navigate, tagsResults};

  return useGroupBysImpl(options);
}

function useGroupBysImpl({location, navigate, tagsResults}: Options): GroupBysResult {
  const {data: tags, isLoading: isLoadingTags} = tagsResults;

  const groupBys = useMemo(() => {
    const rawGroupBys = decodeList(location.query.groupBy);

    // Filter out groupBys that are not in span field supported tags
    const validGroupBys = isLoadingTags
      ? []
      : rawGroupBys.filter(groupBy => groupBy === '' || tags?.hasOwnProperty(groupBy));

    if (validGroupBys.length) {
      return validGroupBys;
    }

    return [''];
  }, [location.query.groupBy, tags, isLoadingTags]);

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

  return {
    groupBys,
    setGroupBys,
    isLoadingGroupBys: isLoadingTags,
  };
}
