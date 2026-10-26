import {createRef} from 'react';

import {dragHandle} from 'sentry-test/dragMove';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SplitPanel, type SplitPanelHandle} from '@sentry/scraps/splitPanel';

describe('SplitPanel', () => {
  it('renders both panes and a divider', () => {
    render(
      <SplitPanel
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
    render(<SplitPanel defaultSize={200} sized={<div>sized</div>} />);

    expect(screen.getByText('sized')).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('floors the sized pane at minSize when the seeded size is below it', () => {
    // A persisted/seeded size below min (here negative) must not produce a
    // negative flex-basis; the rendered size is floored at minSize.
    render(
      <SplitPanel
        defaultSize={200}
        initialSize={-50}
        minSize={100}
        sized={<div>sized</div>}
        fill={<div>fill</div>}
      />
    );

    // https://github.com/testing-library/jest-dom/issues/735
    // eslint-disable-next-line jest-dom/prefer-to-have-value
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '100');
  });

  it('preserves the sized pane DOM node when the fill pane is toggled', () => {
    const sized = <div>sized</div>;
    const {rerender} = render(
      <SplitPanel defaultSize={200} sized={sized} fill={<div>fill</div>} />
    );
    const before = screen.getByText('sized');

    rerender(<SplitPanel defaultSize={200} sized={sized} />);

    expect(screen.getByText('sized')).toBe(before);
  });

  it('exposes the divider as a separator with orientation and value attributes', () => {
    render(
      <SplitPanel
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

    // https://github.com/testing-library/jest-dom/issues/735
    // eslint-disable-next-line jest-dom/prefer-to-have-value
    expect(separator).toHaveAttribute('aria-valuenow', '200');
    expect(separator).toHaveAttribute('tabindex', '0');
  });

  it('exposes a setSize handle that updates the sized pane', () => {
    const ref = createRef<SplitPanelHandle>();
    render(
      <SplitPanel
        ref={ref}
        defaultSize={200}
        minSize={100}
        maxSize={600}
        sized={<div>sized</div>}
        fill={<div>fill</div>}
      />
    );

    // https://github.com/testing-library/jest-dom/issues/735
    // eslint-disable-next-line jest-dom/prefer-to-have-value
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '200');

    // Lets a parent seed the size from a post-mount measurement without a remount.
    act(() => ref.current?.setSize(350));

    // https://github.com/testing-library/jest-dom/issues/735
    // eslint-disable-next-line jest-dom/prefer-to-have-value
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '350');
  });

  describe('sizing', () => {
    it("derives the sized pane's max from fillMinSize and the container", () => {
      const clientWidth = jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(600);

      render(
        <SplitPanel
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

      // https://github.com/testing-library/jest-dom/issues/735
      // eslint-disable-next-line jest-dom/prefer-to-have-value
      expect(separator).toHaveAttribute('aria-valuenow', '400');

      await userEvent.dblClick(separator);

      // Resets to the canonical default and reports it so consumers can persist.

      // https://github.com/testing-library/jest-dom/issues/735
      // eslint-disable-next-line jest-dom/prefer-to-have-value
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

      // https://github.com/testing-library/jest-dom/issues/735
      // eslint-disable-next-line jest-dom/prefer-to-have-value
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

      // https://github.com/testing-library/jest-dom/issues/735
      // eslint-disable-next-line jest-dom/prefer-to-have-value
      expect(separator).toHaveAttribute('aria-valuenow', '110');
    });

    it('treats a Home/End edge as a no-op while max is unbounded', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
          defaultSize={200}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      separator.focus();
      // End targets max — but max is unbounded until the container is
      // measured, so it must not set an infinite size.
      await userEvent.keyboard('{End}');

      // https://github.com/testing-library/jest-dom/issues/735
      // eslint-disable-next-line jest-dom/prefer-to-have-value
      expect(separator).toHaveAttribute('aria-valuenow', '200');
      expect(onResizeEnd).not.toHaveBeenCalled();
    });

    it('fires onResizeEnd on keyboard resize so the size can be persisted', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel
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
          defaultSize={200}
          minSize={100}
          onResizeEnd={onResizeEnd}
          sized={<div>sized</div>}
          fill={<div>fill</div>}
        />
      );

      const separator = screen.getByRole('separator');
      dragHandle(separator, {from: 200, to: 150});

      // https://github.com/testing-library/jest-dom/issues/735
      // eslint-disable-next-line jest-dom/prefer-to-have-value
      await waitFor(() => expect(separator).toHaveAttribute('aria-valuenow', '150'));
      await waitFor(() =>
        expect(onResizeEnd).toHaveBeenCalledWith({
          startSize: 200,
          endSize: 150,
          direction: 'decrease',
        })
      );
    });
  });
});
