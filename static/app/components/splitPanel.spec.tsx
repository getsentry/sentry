import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SplitPanel} from 'sentry/components/splitPanel';
import type {BreakpointSize} from 'sentry/utils/theme';

const theme = ThemeFixture();

// Stub window.matchMedia so a chosen set of breakpoints reports as active.
function setupMediaQueries(matches: Partial<Record<BreakpointSize, boolean>>) {
  const original = window.matchMedia;
  window.matchMedia = jest.fn((query: string) => {
    const value = query.match(/min-width:\s*(.+?)\)/)?.[1];
    const name = Object.entries(theme.breakpoints).find(([, v]) => v === value)?.[0];
    return {
      matches: name ? (matches[name as BreakpointSize] ?? false) : false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as unknown as MediaQueryList;
  });
  return () => {
    window.matchMedia = original;
  };
}

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

  it('resolves the orientation for the active breakpoint', () => {
    const cleanup = setupMediaQueries({xs: true, sm: true, md: true});

    render(
      <SplitPanel
        orientation={{xs: 'vertical', md: 'horizontal'}}
        defaultSize={200}
        sized={<div>one</div>}
        fill={<div>two</div>}
      />
    );

    // md is active, so the panel splits horizontally (separator runs vertically).
    expect(screen.getByRole('separator')).toHaveAttribute(
      'data-orientation',
      'horizontal'
    );

    cleanup();
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
  });
});
