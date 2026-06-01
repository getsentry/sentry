import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

describe('useResizableDrawer', () => {
  // Drive requestAnimationFrame manually so we can hold a scheduled frame
  // "pending" across a mouseup, reproducing the race where a frame would
  // otherwise run after the drag has ended.
  let scheduled: Map<number, FrameRequestCallback>;
  let cancelled: Set<number>;
  let nextFrameId: number;

  function flushFrames() {
    scheduled.forEach((cb, id) => {
      scheduled.delete(id);
      if (!cancelled.has(id)) {
        cb(0);
      }
    });
  }

  beforeEach(() => {
    scheduled = new Map();
    cancelled = new Set();
    nextFrameId = 1;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      const id = nextFrameId++;
      scheduled.set(id, cb);
      return id;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
      cancelled.add(id);
      scheduled.delete(id);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels a pending frame on mouseup so size is not mutated after the drag ends', () => {
    const onResize = jest.fn();
    const onResizeEnd = jest.fn();

    const {result} = renderHook(() =>
      useResizableDrawer({
        direction: 'left',
        initialSize: 200,
        min: 0,
        max: 1000,
        onResize,
        onResizeEnd,
      })
    );

    // The mount effect fires onResize once with the initial size; ignore it.
    onResize.mockClear();

    // Start dragging from x=500.
    act(() => {
      result.current.onMouseDown({
        clientX: 500,
        clientY: 0,
      } as React.MouseEvent<HTMLElement>);
    });

    // Move the cursor — this schedules a frame but does not run it yet.
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', {clientX: 450, clientY: 0}));
    });
    expect(scheduled.size).toBe(1);

    // Release the mouse before the scheduled frame runs.
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    // The pending frame must be cancelled so it cannot mutate size afterwards.
    expect(cancelled.size).toBe(1);

    // Even if a frame somehow fires, it must not call onResize after the drag
    // has ended.
    act(() => {
      flushFrames();
    });
    expect(onResize).not.toHaveBeenCalled();

    // onResizeEnd reports the size at release, consistent with the final size.
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    expect(onResizeEnd).toHaveBeenCalledWith({startSize: 200, endSize: 200});
  });

  it('detaches listeners and restores document styles when unmounted mid-drag', () => {
    const removeListener = jest.spyOn(document, 'removeEventListener');

    const {result, unmount} = renderHook(() =>
      useResizableDrawer({
        direction: 'left',
        initialSize: 200,
        min: 0,
        max: 1000,
        onResize: jest.fn(),
      })
    );

    // Start dragging and move once — onMouseMove disables pointer events on the
    // body and sets the resize cursor.
    act(() => {
      result.current.onMouseDown({
        clientX: 500,
        clientY: 0,
      } as React.MouseEvent<HTMLElement>);
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', {clientX: 480, clientY: 0}));
    });
    expect(document.body).toHaveStyle({pointerEvents: 'none', userSelect: 'none'});
    expect(document.documentElement).toHaveStyle({cursor: 'ew-resize'});

    // Unmounting while the drag is still active must tear everything down,
    // otherwise the app is left non-interactive (body pointer-events: none).
    unmount();

    expect(document.body).not.toHaveStyle({pointerEvents: 'none'});
    expect(document.body).not.toHaveStyle({userSelect: 'none'});
    expect(document.documentElement).not.toHaveStyle({cursor: 'ew-resize'});
    expect(removeListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });

  it('fires onResizeEnd when the size is reset via double-click', () => {
    const onResizeEnd = jest.fn();
    const {result} = renderHook(() =>
      useResizableDrawer({
        direction: 'left',
        initialSize: 200,
        min: 0,
        max: 1000,
        onResize: jest.fn(),
        onResizeEnd,
      })
    );

    // Drag to a new size first so the reset has something to revert from.
    act(() => {
      result.current.setSize(350, true);
    });

    act(() => {
      result.current.onDoubleClick({} as React.MouseEvent<HTMLElement>);
    });

    // Consumers that only persist on resize end (e.g. saving the split width)
    // must see the reset back to the initial size.
    expect(onResizeEnd).toHaveBeenCalledWith({startSize: 350, endSize: 200});
  });
});
