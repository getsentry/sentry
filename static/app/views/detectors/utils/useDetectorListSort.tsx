import {useQueryState} from 'nuqs';

import {parseAsSort} from 'sentry/utils/queryString';

export function useDetectorListSort() {
  return useQueryState(
    'sort',
    parseAsSort.withDefault({kind: 'desc', field: 'latestGroup'}).withOptions({
      history: 'push',
    })
  );
}
