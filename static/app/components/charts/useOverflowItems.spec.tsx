import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useOverflowItems} from './useOverflowItems';

let resizeCallback: ResizeObserverCallback;
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();

  window.ResizeObserver = jest.fn(callback => {
    resizeCallback = callback;
    return {
      observe: mockObserve,
      disconnect: mockDisconnect,
      unobserve: jest.fn(),
    };
  }) as any;
});

/**
 * Creates a container div with `childCount` children.
 * The container has a fixed `offsetWidth`, and each child has a fixed width
 * returned by `getBoundingClientRect`. Gap is simulated via `getComputedStyle`.
 */
function makeContainer(
  childCount: number,
  containerWidth: number,
  childWidth: number,
  gap = 0
): React.RefObject<HTMLDivElement> {
  const container = document.createElement('div');
  Object.defineProperty(container, 'offsetWidth', {
    value: containerWidth,
    configurable: true,
  });

  // Mock getComputedStyle for gap
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = jest.fn(el => {
    if (el === container) {
      return {columnGap: `${gap}px`} as CSSStyleDeclaration;
    }
    return originalGetComputedStyle(el);
  });

  for (let i = 0; i < childCount; i++) {
    const child = document.createElement('div');
    child.getBoundingClientRect = jest.fn(() => ({width: childWidth}) as DOMRect);
    container.appendChild(child);
  }

  return {current: container} as React.RefObject<HTMLDivElement>;
}

describe('useOverflowItems', () => {
  it('returns all items as visible when they fit', () => {
    // 3 children × 50px = 150px, container = 200px
    const containerRef = makeContainer(3, 200, 50);
    const items = ['a', 'b', 'c'];

    const {result} = renderHook(() => useOverflowItems(containerRef, items));

    expect(result.current.visibleItems).toEqual(['a', 'b', 'c']);
    expect(result.current.overflowItems).toEqual([]);
  });

  it('detects overflow when children exceed container width', () => {
    // 4 children × 50px = 200px, container = 150px
    const containerRef = makeContainer(4, 150, 50);
    const items = ['a', 'b', 'c', 'd'];

    const {result} = renderHook(() => useOverflowItems(containerRef, items));

    expect(result.current.visibleItems).toEqual(['a', 'b', 'c']);
    expect(result.current.overflowItems).toEqual(['d']);
  });

  it('accounts for gap between children', () => {
    // 3 children × 50px + 2 gaps × 10px = 170px, container = 160px
    const containerRef = makeContainer(3, 160, 50, 10);
    const items = ['a', 'b', 'c'];

    const {result} = renderHook(() => useOverflowItems(containerRef, items));

    expect(result.current.visibleItems).toEqual(['a', 'b']);
    expect(result.current.overflowItems).toEqual(['c']);
  });

  it('recalculates on container resize', async () => {
    const containerRef = makeContainer(3, 200, 50);
    const items = ['a', 'b', 'c'];

    const {result} = renderHook(() => useOverflowItems(containerRef, items));

    expect(result.current.visibleItems).toEqual(['a', 'b', 'c']);

    // Simulate container shrinking
    Object.defineProperty(containerRef.current!, 'offsetWidth', {value: 90});
    await act(async () => {
      resizeCallback([] as ResizeObserverEntry[], {} as ResizeObserver);
      // Flush the microtask scheduled by scheduleMicroTask
      await Promise.resolve();
    });

    expect(result.current.visibleItems).toEqual(['a']);
    expect(result.current.overflowItems).toEqual(['b', 'c']);
  });

  it('handles empty items array', () => {
    const containerRef = makeContainer(0, 200, 50);

    const {result} = renderHook(() => useOverflowItems(containerRef, [] as string[]));

    expect(result.current.visibleItems).toEqual([]);
    expect(result.current.overflowItems).toEqual([]);
  });

  it('cleans up observer on unmount', () => {
    const containerRef = makeContainer(2, 200, 50);
    const items = ['a', 'b'];

    const {unmount} = renderHook(() => useOverflowItems(containerRef, items));

    expect(mockDisconnect).not.toHaveBeenCalled();
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
