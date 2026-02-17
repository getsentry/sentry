import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useOverflowItems} from './useOverflowItems';

let observerCallback: IntersectionObserverCallback;
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();

  window.IntersectionObserver = jest.fn(callback => {
    observerCallback = callback;
    return {
      observe: mockObserve,
      disconnect: mockDisconnect,
      unobserve: jest.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: jest.fn(),
    };
  }) as any;
});

function makeContainer(childCount: number): React.RefObject<HTMLDivElement> {
  const container = document.createElement('div');
  for (let i = 0; i < childCount; i++) {
    container.appendChild(document.createElement('div'));
  }
  const ref = {current: container};
  return ref as React.RefObject<HTMLDivElement>;
}

function simulateEntries(
  containerRef: React.RefObject<HTMLElement | null>,
  overflowingIndices: number[]
) {
  const children = Array.from(containerRef.current!.children);
  const entries = children.map((child, index) => ({
    target: child,
    isIntersecting: !overflowingIndices.includes(index),
    intersectionRatio: overflowingIndices.includes(index) ? 0 : 1,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: Date.now(),
  })) as IntersectionObserverEntry[];

  act(() => {
    observerCallback(entries, {} as IntersectionObserver);
  });
}

describe('useOverflowItems', () => {
  it('returns all items as visible when nothing overflows', () => {
    const items = ['a', 'b', 'c'];
    const containerRef = makeContainer(3);

    const {result} = renderHook(() => useOverflowItems(containerRef, items));

    // Simulate all children as intersecting
    simulateEntries(containerRef, []);

    expect(result.current.visibleItems).toEqual(['a', 'b', 'c']);
    expect(result.current.overflowItems).toEqual([]);
  });

  it('returns correct partition when some items overflow', () => {
    const items = ['a', 'b', 'c', 'd'];
    const containerRef = makeContainer(4);

    const {result} = renderHook(() => useOverflowItems(containerRef, items));

    // Items at indices 2 and 3 overflow
    simulateEntries(containerRef, [2, 3]);

    expect(result.current.visibleItems).toEqual(['a', 'b']);
    expect(result.current.overflowItems).toEqual(['c', 'd']);
  });

  it('re-partitions when items change', () => {
    const containerRef = makeContainer(3);
    let items = ['a', 'b', 'c'];

    const {result, rerender} = renderHook(() => useOverflowItems(containerRef, items));

    // Index 2 overflows
    simulateEntries(containerRef, [2]);

    expect(result.current.visibleItems).toEqual(['a', 'b']);
    expect(result.current.overflowItems).toEqual(['c']);

    // Add a child to the container and update items
    containerRef.current!.appendChild(document.createElement('div'));
    items = ['a', 'b', 'c', 'd'];
    rerender();

    // Now only index 3 overflows
    simulateEntries(containerRef, [3]);

    expect(result.current.visibleItems).toEqual(['a', 'b', 'c']);
    expect(result.current.overflowItems).toEqual(['d']);
  });

  it('handles empty items array', () => {
    const containerRef = makeContainer(0);

    const {result} = renderHook(() => useOverflowItems(containerRef, [] as string[]));

    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.overflowItems).toEqual([]);
  });

  it('cleans up observer on unmount', () => {
    const items = ['a', 'b'];
    const containerRef = makeContainer(2);

    const {unmount} = renderHook(() => useOverflowItems(containerRef, items));

    expect(mockDisconnect).not.toHaveBeenCalled();
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
