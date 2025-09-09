import type {ReactNode} from 'react';
import {useCallback, useMemo, useState} from 'react';

import {defaultLogFields} from 'sentry/views/explore/contexts/logs/fields';
import {defaultSortBys} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  defaultAggregateSortBys,
  defaultVisualizes,
} from 'sentry/views/explore/logs/logsQueryParams';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {defaultGroupBys} from 'sentry/views/explore/queryParams/groupBy';
import {defaultMode} from 'sentry/views/explore/queryParams/mode';
import {defaultQuery} from 'sentry/views/explore/queryParams/query';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface LogsStateQueryParamsProviderProps {
  children: ReactNode;
}

export function LogsStateQueryParamsProvider({
  children,
}: LogsStateQueryParamsProviderProps) {
  const [mode, _setMode] = useState(defaultMode());
  const [query, _setQuery] = useState(defaultQuery());

  const [cursor, _setCursor] = useState(defaultCursor());
  const [fields, _setFields] = useState(defaultLogFields());
  const [sortBys, _setSortBys] = useState(defaultSortBys(fields));

  const [aggregateCursor, _setAggregateCursor] = useState(defaultCursor());
  const [aggregateFields, _setAggregateFields] = useState(defaultAggregateFields());
  const [aggregateSortBys, _setAggregateSortBys] = useState(
    defaultAggregateSortBys(aggregateFields)
  );

  const readableQueryParams = useMemo(() => {
    return new ReadableQueryParams({
      extrapolate: true,
      mode,
      query,

      cursor,
      fields,
      sortBys,

      aggregateCursor,
      aggregateFields,
      aggregateSortBys,
    });
  }, [
    mode,
    query,
    cursor,
    fields,
    sortBys,
    aggregateCursor,
    aggregateFields,
    aggregateSortBys,
  ]);

  const setWritableQueryParams = useCallback(
    (_writableQueryParams: WritableQueryParams) => {
      // TODO
    },
    []
  );

  return (
    <QueryParamsContextProvider
      queryParams={readableQueryParams}
      setQueryParams={setWritableQueryParams}
      isUsingDefaultFields
      shouldManageFields={false}
    >
      {children}
    </QueryParamsContextProvider>
  );
}

function defaultAggregateFields() {
  return [...defaultGroupBys(), ...defaultVisualizes()];
}
