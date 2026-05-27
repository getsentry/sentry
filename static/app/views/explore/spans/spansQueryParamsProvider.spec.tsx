import type {ReactNode} from 'react';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  useSetQueryParamsAggregateFields,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

function Wrapper({children}: {children: ReactNode}) {
  return <SpansQueryParamsProvider>{children}</SpansQueryParamsProvider>;
}

function useSpansQueryParamSetters() {
  return {
    setAggregateFields: useSetQueryParamsAggregateFields(),
    setQuery: useSetQueryParamsQuery(),
  };
}

describe('SpansQueryParamsProvider', () => {
  it('writes query updates through nuqs and clears cursors', async () => {
    const {result, router} = renderHookWithProviders(useSpansQueryParamSetters, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            aggregateCursor: '50:0:1',
            cursor: '0:0:1',
          },
        },
      },
    });

    act(() => result.current.setQuery('span.op:db'));

    await waitFor(() => {
      expect(router.location.query.query).toBe('span.op:db');
    });
    expect(router.location.query.cursor).toBeUndefined();
    expect(router.location.query.aggregateCursor).toBeUndefined();
  });

  it('writes aggregate fields canonically and clears legacy aggregate params', async () => {
    const {result, router} = renderHookWithProviders(useSpansQueryParamSetters, {
      additionalWrapper: Wrapper,
      initialRouterConfig: {
        location: {
          pathname: '/traces/',
          query: {
            aggregateCursor: '50:0:1',
            cursor: '0:0:1',
            groupBy: 'span.op',
            visualize: JSON.stringify({yAxes: ['count(span.duration)']}),
          },
        },
      },
    });

    act(() =>
      result.current.setAggregateFields([
        {groupBy: 'transaction'},
        {yAxes: ['p50(span.duration)']},
      ])
    );

    await waitFor(() => {
      expect(router.location.query.aggregateField).toEqual([
        '{"groupBy":"transaction"}',
        '{"yAxes":["p50(span.duration)"]}',
      ]);
    });
    expect(router.location.query.groupBy).toBeUndefined();
    expect(router.location.query.visualize).toBeUndefined();
    expect(router.location.query.cursor).toBeUndefined();
    expect(router.location.query.aggregateCursor).toBeUndefined();
  });
});
