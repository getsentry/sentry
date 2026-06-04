import {parseAsInteger, parseAsString, useQueryStates} from 'nuqs';

export enum DrawerUrlParams {
  SELECTED_SPAN = 'span',
  SELECTED_TRACE = 'trace',
  TIMESTAMP = 'trace-timestamp',
}

export enum TableUrlParams {
  CURSOR = 'tableCursor',
  SORT_FIELD = 'sortField',
  SORT_ORDER = 'sortKind',
}

export function useTraceDrawerQueryState() {
  return useQueryStates(
    {
      traceId: parseAsString,
      spanId: parseAsString,
      timestamp: parseAsInteger,
    },
    {
      history: 'replace',
      urlKeys: {
        traceId: DrawerUrlParams.SELECTED_TRACE,
        spanId: DrawerUrlParams.SELECTED_SPAN,
        timestamp: DrawerUrlParams.TIMESTAMP,
      },
    }
  );
}
