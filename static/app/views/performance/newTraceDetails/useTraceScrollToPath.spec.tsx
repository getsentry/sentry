import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {TraceTree} from './traceModels/traceTree';
import {useTraceScrollToPath} from './useTraceScrollToPath';

describe('useTraceScrollToPath', () => {
  const originalSearch = window.location.search;

  afterEach(() => {
    window.history.replaceState({}, '', `/${originalSearch}`);
  });

  function setSearch(search: string) {
    window.history.replaceState({}, '', `/${search}`);
  }

  it('reads the scroll target from the URL when the caller does not provide one', () => {
    setSearch('?node=span-abc123');

    const {result} = renderHook(() => useTraceScrollToPath({traceSlug: 'trace-slug'}));

    expect(result.current.current).toEqual({eventId: undefined, path: ['span-abc123']});
  });

  it('prefers an explicit scroll target over the URL', () => {
    setSearch('?node=span-fromurl');

    const scrollToNode = {
      eventId: 'fromprops',
      path: ['span-fromprops'] as TraceTree.NodePath[],
    };
    const {result} = renderHook(() =>
      useTraceScrollToPath({traceSlug: 'trace-slug', scrollToNode})
    );

    expect(result.current.current).toBe(scrollToNode);
  });

  it('ignores the URL entirely when the caller passes null', () => {
    // Embedded waterfalls pass null so the host page's `?node=` — which may belong to a
    // different trace — cannot steer them.
    setSearch('?node=span-fromurl&eventId=abc123');

    const {result} = renderHook(() =>
      useTraceScrollToPath({traceSlug: 'trace-slug', scrollToNode: null})
    );

    expect(result.current.current).toBeNull();
  });
});
