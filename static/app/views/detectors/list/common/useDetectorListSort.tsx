import {useQueryState} from 'nuqs';

import parseAsSort from 'sentry/utils/url/parseAsSort';

export function useDetectorListSort() {
  return useQueryState(
    'sort',
    parseAsSort.withDefault({kind: 'desc', field: 'latestGroup'}).withOptions({
      history: 'push',
    })
  );
}
