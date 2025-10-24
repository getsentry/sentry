import type {ReactNode} from 'react';

import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

export function MockQueryParamsContextWrapper({children}: {children: ReactNode}) {
  return (
    <QueryParamsContextProvider
      queryParams={
        new ReadableQueryParams({
          aggregateCursor: '',
          aggregateFields: [new VisualizeFunction('sum(test.metric)')],
          aggregateSortBys: [],
          cursor: '',
          extrapolate: true,
          fields: [],
          mode: Mode.SAMPLES,
          query: 'test value',
          sortBys: [],
        })
      }
      setQueryParams={jest.fn()}
      isUsingDefaultFields
      shouldManageFields={false}
    >
      {children}
    </QueryParamsContextProvider>
  );
}
