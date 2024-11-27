import {useCallback} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useUrlBatch} from 'sentry/views/dashboards/widgetBuilder/context/urlBatchContext';

export function useQueryParamState(
  fieldName: string
): [string | undefined, (newField: string | undefined) => void] {
  const {batchUpdates} = useUrlBatch();
  const parsedQueryParams = useLocationQuery({
    fields: {
      [fieldName]: decodeScalar,
    },
  });

  const setField = useCallback(
    (newField: string | undefined) => {
      batchUpdates({[fieldName]: newField});
    },
    [batchUpdates, fieldName]
  );

  return [parsedQueryParams[fieldName], setField];
}
