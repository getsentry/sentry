import type {ReactNode} from 'react';
import {useCallback, useMemo, useState} from 'react';

import type {Sort} from 'sentry/utils/discover/fields';
import {useResettableState} from 'sentry/utils/useResettableState';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {defaultMode} from 'sentry/views/explore/queryParams/mode';
import {defaultQuery} from 'sentry/views/explore/queryParams/query';
import {
  ReadableQueryParams,
  type ReadableQueryParamsOptions,
} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface ExploreStateQueryParamsProviderProps {
  children: ReactNode;
  defaultAggregateFields: () => AggregateField[];
  defaultAggregateSortBys: (aggregateFields: AggregateField[]) => Sort[];
  defaultFields: () => string[];
  defaultSortBys: (fields: string[]) => Sort[];
  frozenParams?: Partial<ReadableQueryParamsOptions>;
}

export function ExploreStateQueryParamsProvider({
  children,
  defaultFields,
  defaultSortBys,
  defaultAggregateFields,
  defaultAggregateSortBys,
  frozenParams,
}: ExploreStateQueryParamsProviderProps) {
  const [mode, _setMode] = useState(defaultMode());
  const [query, setQuery] = useResettableState(defaultQuery);

  const [cursor, _setCursor] = useState(defaultCursor());
  const [fields, _setFields] = useState(defaultFields());
  const [sortBys, _setSortBys] = useState(defaultSortBys(fields));

  const [aggregateCursor, _setAggregateCursor] = useState(defaultCursor());
  const [aggregateFields, _setAggregateFields] = useState(defaultAggregateFields());
  const [aggregateSortBys, _setAggregateSortBys] = useState(
    defaultAggregateSortBys(aggregateFields)
  );

  const _readableQueryParams = useMemo(() => {
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

  const readableQueryParams = useMemo(
    () =>
      frozenParams ? _readableQueryParams.replace(frozenParams) : _readableQueryParams,
    [_readableQueryParams, frozenParams]
  );

  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      setQuery(writableQueryParams.query);
    },
    [setQuery]
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
