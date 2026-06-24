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
  it('clamps the size to [min, max] when a drag starts from an out-of-range seed', async () => {
    const onResizeEnd = jest.fn();
    render(
      <DragHarness
        direction="left"
        initialSize={-50}
        min={100}
        onResize={() => {}}
        onResizeEnd={onResizeEnd}
      />
    );

    const handle = screen.getByRole('button', {name: 'handle'});
    await userEvent.pointer([
      {keys: '[MouseLeft>]', target: handle, coords: {x: 200, y: 0}},
      {target: handle, coords: {x: 400, y: 0}},
    ]);

    // The +200px drag steps from the clamped 100 base, not the raw -50 seed
    // (which would have produced 150).
    await waitFor(() => expect(handle).toHaveAttribute('data-size', '300'));

    act(() => {
      document.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}));
    });

    // startSize is the clamped base, never the out-of-range seed.
    await waitFor(() =>
      expect(onResizeEnd).toHaveBeenCalledWith({startSize: 100, endSize: 300})
    );
  });
});
