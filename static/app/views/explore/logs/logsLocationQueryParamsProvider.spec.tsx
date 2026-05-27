import type {ReactNode} from 'react';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  LOGS_AGGREGATE_CURSOR_KEY,
  LOGS_AGGREGATE_FN_KEY,
  LOGS_AGGREGATE_PARAM_KEY,
  LOGS_CURSOR_KEY,
  LOGS_GROUP_BY_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_AGGREGATE_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {LogsLocationQueryParamsProvider} from 'sentry/views/explore/logs/logsLocationQueryParamsProvider';
import {LOGS_AGGREGATE_FIELD_KEY} from 'sentry/views/explore/logs/logsQueryParams';
import {
  useSetQueryParamsAggregateFields,
  useSetQueryParamsAggregateSortBys,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';

function Wrapper({children}: {children: ReactNode}) {
  return <LogsLocationQueryParamsProvider>{children}</LogsLocationQueryParamsProvider>;
}

function useLogsQueryParamSetters() {
  return {
    setAggregateFields: useSetQueryParamsAggregateFields(),
    setAggregateSortBys: useSetQueryParamsAggregateSortBys(),
    setQuery: useSetQueryParamsQuery(),
  };
}

describe('LogsLocationQueryParamsProvider', () => {
  it('writes query updates through nuqs and clears cursors', async () => {
    const {result, router} = renderHookWithProviders(useLogsQueryParamSetters, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/logs/',
          query: {
            [LOGS_AGGREGATE_CURSOR_KEY]: '50:0:1',
            [LOGS_CURSOR_KEY]: '0:0:1',
          },
        },
      },
    });

    act(() => result.current.setQuery('message:foobar'));

    await waitFor(() => {
      expect(router.location.query[LOGS_QUERY_KEY]).toBe('message:foobar');
    });
    expect(router.location.query[LOGS_CURSOR_KEY]).toBeUndefined();
    expect(router.location.query[LOGS_AGGREGATE_CURSOR_KEY]).toBeUndefined();
  });

  it('writes aggregate fields canonically and clears legacy aggregate params', async () => {
    const {result, router} = renderHookWithProviders(useLogsQueryParamSetters, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/logs/',
          query: {
            [LOGS_AGGREGATE_CURSOR_KEY]: '50:0:1',
            [LOGS_AGGREGATE_FN_KEY]: 'p99',
            [LOGS_AGGREGATE_PARAM_KEY]: 'severity_number',
            [LOGS_CURSOR_KEY]: '0:0:1',
            [LOGS_GROUP_BY_KEY]: 'message.template',
          },
        },
      },
    });

    act(() =>
      result.current.setAggregateFields([
        {groupBy: 'severity'},
        {yAxes: ['count(message)']},
      ])
    );

    await waitFor(() => {
      expect(router.location.query[LOGS_AGGREGATE_FIELD_KEY]).toEqual([
        '{"groupBy":"severity"}',
        '{"yAxes":["count(message)"]}',
      ]);
    });
    expect(router.location.query[LOGS_GROUP_BY_KEY]).toBeUndefined();
    expect(router.location.query[LOGS_AGGREGATE_FN_KEY]).toBeUndefined();
    expect(router.location.query[LOGS_AGGREGATE_PARAM_KEY]).toBeUndefined();
    expect(router.location.query[LOGS_CURSOR_KEY]).toBeUndefined();
    expect(router.location.query[LOGS_AGGREGATE_CURSOR_KEY]).toBeUndefined();
  });

  it('writes aggregate sort updates through nuqs', async () => {
    const {result, router} = renderHookWithProviders(useLogsQueryParamSetters, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/logs/',
          query: {},
        },
      },
    });

    act(() =>
      result.current.setAggregateSortBys([{field: 'count(message)', kind: 'asc'}])
    );

    await waitFor(() => {
      expect(router.location.query[LOGS_AGGREGATE_SORT_BYS_KEY]).toBe('count(message)');
    });
  });
});
