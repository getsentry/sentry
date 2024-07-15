import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useArrayCache} from 'sentry/views/insights/common/utils/useArrayCache';

describe('useArrayCache', function () {
  it('keeps a cache', function () {
    const {result, rerender} = renderHook(useArrayCache, {
      initialProps: {items: ['hello', 'hi']},
    });

    expect(result.current).toEqual(['hello', 'hi']);

    rerender({items: ['aloha', 'ahoy']});
    expect(result.current).toEqual(['hello', 'hi', 'aloha', 'ahoy']);

    rerender({items: ['heya']});
    expect(result.current).toEqual(['hello', 'hi', 'aloha', 'ahoy', 'heya']);
  });

  it('respects a sorting function', function () {
    const {result, rerender} = renderHook(useArrayCache, {
      initialProps: {
        items: ['b', 'a', 'c'],
        sortFn: sortAscending,
      },
    });

    expect(result.current).toEqual(['a', 'b', 'c']);

    rerender({items: ['d'], sortFn: sortAscending});
    expect(result.current).toEqual(['a', 'b', 'c', 'd']);

    rerender({items: [], sortFn: sortDescending});
    expect(result.current).toEqual(['d', 'c', 'b', 'a']);
  });

  it('respects a limit', function () {
    const {result, rerender} = renderHook(useArrayCache, {
      initialProps: {
        items: ['a', 'b', 'c', 'd'],
        limit: 10,
      },
    });

    expect(result.current).toEqual(['a', 'b', 'c', 'd']);

    rerender({items: ['e', 'f'], limit: 5});
    expect(result.current).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

const sortAscending = (items: string[]) => {
  return [...items].sort((a, b) => a.localeCompare(b));
};

const sortDescending = (items: string[]) => {
  return [...items].sort((a, b) => b.localeCompare(a));
};
