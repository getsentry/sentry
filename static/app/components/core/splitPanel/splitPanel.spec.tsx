import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SplitPanel} from '@sentry/scraps/splitPanel';

describe('SplitPanel', () => {
  it('renders both panes and a divider', () => {
    render(
      <SplitPanel
        orientation="horizontal"
        defaultSize={200}
        minSize={100}
        sized={<div>sized</div>}
        fill={<div>fill</div>}
      />
    );

    expect(screen.getByText('sized')).toBeInTheDocument();
    expect(screen.getByText('fill')).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('renders only the sized pane (no divider) when fill is omitted', () => {
    render(
      <SplitPanel orientation="horizontal" defaultSize={200} sized={<div>sized</div>} />
    );

    expect(screen.getByText('sized')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('floors the sized pane at minSize when the seeded size is below it', () => {
    // A persisted/seeded size below min (here negative) must not produce a
    // negative flex-basis; the rendered size is floored at minSize.
    render(
      <SplitPanel
        orientation="horizontal"
        defaultSize={200}
        initialSize={-50}
        minSize={100}
        sized={<div>sized</div>}
        fill={<div>fill</div>}
      />
    );

    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '100');
  });

  it('preserves the sized pane DOM node when the fill pane is toggled', () => {
    const sized = <div>sized</div>;
    const {rerender} = render(
      <SplitPanel
        orientation="horizontal"
        defaultSize={200}
        sized={sized}
        fill={<div>fill</div>}
      />
    );
    const before = screen.getByText('sized');

    rerender(<SplitPanel orientation="horizontal" defaultSize={200} sized={sized} />);

    expect(screen.getByText('sized')).toBe(before);
  });

  it('places the sized pane after the fill pane when placement is "end"', () => {
    render(
      <SplitPanel
        orientation="horizontal"
        placement="end"
        defaultSize={200}
        sized={<div>sized</div>}
        fill={<div>fill</div>}
      />
    );

    const sized = screen.getByText('sized');
    const fill = screen.getByText('fill');
    // `sized` follows `fill` in the DOM.
    expect(
      fill.compareDocumentPosition(sized) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('exposes the divider as a separator with orientation and value attributes', () => {
    render(
      <SplitPanel
        orientation="horizontal"
        defaultSize={200}
        minSize={100}
        maxSize={600}
        sized={<div>sized</div>}
        fill={<div>fill</div>}
      />
    );

    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator).toHaveAttribute('aria-valuemin', '100');
    expect(separator).toHaveAttribute('aria-valuemax', '600');
    expect(separator).toHaveAttribute('aria-valuenow', '200');
    expect(separator).toHaveAttribute('tabindex', '0');
  });

  describe('sizing', () => {
    it("derives the sized pane's max from fillMinSize and the container", () => {
      const clientWidth = jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(600);

      render(
        <SplitPanel
          orientation="horizontal"
          defaultSize={200}
          minSize={100}
          fillMinSize={400}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      // 600 container - 400 fill min - 1 divider = 199.
      expect(screen.getByRole('separator')).toHaveAttribute('aria-valuemax', '199');

      clientWidth.mockRestore();
    });

    it('never clamps max below min when the container is narrower than minSize', () => {
      const clientWidth = jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(50);

      render(
        <SplitPanel
          orientation="horizontal"
          defaultSize={200}
          minSize={100}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('aria-valuemin', '100');
      // Floored at `min` rather than the 50px container width.
      expect(separator).toHaveAttribute('aria-valuemax', '100');

      clientWidth.mockRestore();
    });

    it('double-click resets to defaultSize, not the initial size', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
          orientation="horizontal"
          defaultSize={200}
          initialSize={400}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      // `initialSize` seeds the starting value.
      expect(separator).toHaveAttribute('aria-valuenow', '400');

      await userEvent.dblClick(separator);

      // Resets to the canonical default and reports it so consumers can persist.
      expect(separator).toHaveAttribute('aria-valuenow', '200');
      expect(onResizeEnd).toHaveBeenCalledWith({
        startSize: 400,
        endSize: 200,
        direction: 'decrease',
      });
    });

    it('reports the clamped visible size as startSize when seeded below min', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
          orientation="horizontal"
          defaultSize={200}
          initialSize={-50}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      // Renders floored at min, not the seeded -50.
      expect(separator).toHaveAttribute('aria-valuenow', '100');

      await userEvent.dblClick(separator);

      // startSize must match the rendered size (100), not the unclamped -50.
      expect(onResizeEnd).toHaveBeenCalledWith({
        startSize: 100,
        endSize: 200,
        direction: 'increase',
      });
    });

    it('keyboard grow steps from the clamped visible size when seeded below min', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
          orientation="horizontal"
          defaultSize={200}
          initialSize={-50}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      separator.focus();
      // A single grow keypress must move off min (110), not produce a sub-min
      // value (-40) that leaves the pane visually pinned at min.
      await userEvent.keyboard('{ArrowRight}');

      expect(onResizeEnd).toHaveBeenCalledWith({
        startSize: 100,
        endSize: 110,
        direction: 'increase',
      });
      expect(separator).toHaveAttribute('aria-valuenow', '110');
    });

    it('reports a clamped size to onResize at mount when seeded below min', () => {
      const onResize = jest.fn();
      render(
        <SplitPanel
          orientation="horizontal"
          defaultSize={200}
          initialSize={-50}
          minSize={100}
          onResize={onResize}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      // The drawer hook fires onResize at mount with the raw initialSize; it
      // must be floored at min so it matches the rendered size.
      expect(onResize).toHaveBeenCalledWith(100);
      expect(onResize).not.toHaveBeenCalledWith(-50);
    });

    it('treats a Home/End edge as a no-op while max is unbounded', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
          orientation="horizontal"
          placement="end"
          defaultSize={200}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      separator.focus();
      // With the sized pane last, Home targets max — but max is unbounded until
      // the container is measured, so it must not set an infinite size.
      await userEvent.keyboard('{Home}');

      expect(separator).toHaveAttribute('aria-valuenow', '200');
      expect(onResizeEnd).not.toHaveBeenCalled();
    });

    it('fires onResizeEnd on keyboard resize so the size can be persisted', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
          orientation="horizontal"
          defaultSize={200}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      separator.focus();
      await userEvent.keyboard('{ArrowRight}');

      expect(onResizeEnd).toHaveBeenCalledWith({
        startSize: 200,
        endSize: 210,
        direction: 'increase',
      });
    });

    it('resizes with pointer drag events', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
          orientation="horizontal"
          defaultSize={200}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      await userEvent.pointer([
        {keys: '[MouseLeft>]', target: separator, coords: {x: 200, y: 0}},
        {target: separator, coords: {x: 150, y: 0}},
      ]);
      await waitFor(() => expect(separator).toHaveAttribute('aria-valuenow', '150'));

      act(() => {
        document.dispatchEvent(new MouseEvent('pointerup', {bubbles: true}));
      });

      await waitFor(() =>
        expect(onResizeEnd).toHaveBeenCalledWith({
          startSize: 200,
          endSize: 150,
          direction: 'decrease',
        })
      );
    });

    it('maps arrow keys to physical direction for placement="end"', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
          orientation="horizontal"
          placement="end"
          defaultSize={200}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      separator.focus();
      // The sized pane sits after the divider, so moving the separator right
      // (ArrowRight) shrinks it, matching the drag direction.
      await userEvent.keyboard('{ArrowRight}');

      expect(onResizeEnd).toHaveBeenCalledWith({
        startSize: 200,
        endSize: 190,
        direction: 'decrease',
      });
    });
  });
});
