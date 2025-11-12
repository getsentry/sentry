import type {Sort} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

const DEFAULT_SORT: Sort = {kind: 'desc', field: 'latestGroup'};

export function useDetectorListSort(): Sort {
  const location = useLocation();
  const sort = decodeSorts(location.query.sort)[0];

  if (!sort) {
    return DEFAULT_SORT;
  }

  return sort;
}
