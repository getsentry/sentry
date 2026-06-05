import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SplitPanel} from 'sentry/components/splitPanel';

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

      // 600 container − 400 fill min − 1 divider = 199.
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
