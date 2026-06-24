import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  useResizableDrawer,
  type UseResizableDrawerOptions,
} from 'sentry/utils/useResizableDrawer';

function DragHarness(props: UseResizableDrawerOptions) {
  const {size, onPointerDown} = useResizableDrawer(props);
  return (
    <button type="button" data-size={size} onPointerDown={onPointerDown}>
      handle
    </button>
  );
}

describe('useResizableDrawer', () => {
  it('clamps a seed below min before it is ever exposed', () => {
    const onResize = jest.fn();
    render(
      <DragHarness direction="left" initialSize={-50} min={100} onResize={onResize} />
    );

    // The size never enters below min, and the mount onResize reports the
    // clamped value rather than the raw seed.
    expect(screen.getByRole('button', {name: 'handle'})).toHaveAttribute(
      'data-size',
      '100'
    );
    expect(onResize.mock.calls[0]![0]).toBe(100);
  });

  it('re-clamps the size to a tightened max when a drag starts', async () => {
    const onResizeEnd = jest.fn();
    const {rerender} = render(
      <DragHarness
        direction="left"
        initialSize={500}
        min={100}
        max={500}
        onResize={() => {}}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = screen.getByRole('button', {name: 'handle'});
    expect(handle).toHaveAttribute('data-size', '500');

    // Tighten max below the current size (e.g. the viewport shrank). The hook
    // does not reactively re-clamp the stored size.
    rerender(
      <DragHarness
        direction="left"
        initialSize={500}
        min={100}
        max={200}
        onResize={() => {}}
        onResizeEnd={onResizeEnd}
      />
    );
    expect(handle).toHaveAttribute('data-size', '500');

    // Starting a drag must re-clamp to the current max (200) before stepping,
    // so a -50px move lands at 150, not 450->clamped-200.
    await userEvent.pointer([
      {keys: '[MouseLeft>]', target: handle, coords: {x: 200, y: 0}},
      {target: handle, coords: {x: 150, y: 0}},
    ]);
    await waitFor(() => expect(handle).toHaveAttribute('data-size', '150'));

    act(() => {
      document.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}));
    });

    // startSize is the re-clamped 200, never the stale 500.
    await waitFor(() =>
      expect(onResizeEnd).toHaveBeenCalledWith({startSize: 200, endSize: 150})
    );
  });
});
