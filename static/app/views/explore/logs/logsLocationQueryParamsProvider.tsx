import type {ReactNode} from 'react';
import {useCallback} from 'react';

import {defined} from 'sentry/utils/defined';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {
  usePersistedLogsPageParams,
  type PersistedLogsPageParams,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {ExploreLocationQueryParamsProvider} from 'sentry/views/explore/exploreLocationQueryParamsProvider';
import {
  getReadableQueryParamsFromLocation,
  getTargetWithReadableQueryParams,
  isDefaultFields,
} from 'sentry/views/explore/logs/logsQueryParams';
import type {ReadableQueryParamsOptions} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface LogsLocationQueryParamsProviderProps {
  children: ReactNode;
  // Will override the frozen params from the location if the key is provided.
  frozenParams?: Partial<ReadableQueryParamsOptions>;
}

export function LogsLocationQueryParamsProvider({
  children,
  frozenParams,
}: LogsLocationQueryParamsProviderProps) {
  const [_, setPersistentParams] = usePersistedLogsPageParams();

  const onSetWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const toPersist: Partial<PersistedLogsPageParams> = {};

      const sortBys = writableQueryParams.sortBys;
      if (defined(sortBys)) {
        toPersist.sortBys = sortBys;
      }

      if (!isEmptyObject(toPersist)) {
        setPersistentParams(prev => ({
          ...prev,
          ...toPersist,
        }));
      }
    },
    [setPersistentParams]
  );

  return (
    <ExploreLocationQueryParamsProvider
      frozenParams={frozenParams}
      getReadableQueryParamsFromLocation={getReadableQueryParamsFromLocation}
      getTargetWithReadableQueryParams={getTargetWithReadableQueryParams}
      isDefaultFields={isDefaultFields}
      onSetWritableQueryParams={onSetWritableQueryParams}
    >
      {children}
    </ExploreLocationQueryParamsProvider>
  );
}
