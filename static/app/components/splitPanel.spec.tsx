import {Fragment} from 'react';
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
  describe('horizontal orientation', () => {
    it('renders both panels and a divider', () => {
      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      expect(screen.getByText('left')).toBeInTheDocument();
      expect(screen.getByText('right')).toBeInTheDocument();
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('renders only the first panel when the second is omitted', () => {
      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      expect(screen.getByText('left')).toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('preserves DOM identity of the sized panel when toggling the fill panel', () => {
      const {rerender} = render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      const leftBefore = screen.getByText('left');

      rerender(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      expect(screen.getByText('left')).toBe(leftBefore);

      rerender(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      expect(screen.getByText('left')).toBe(leftBefore);
    });
  });

  describe('vertical orientation', () => {
    it('renders both panels and a divider', () => {
      render(
        <SplitPanel.Root orientation="vertical">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>top</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>bottom</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      expect(screen.getByText('top')).toBeInTheDocument();
      expect(screen.getByText('bottom')).toBeInTheDocument();
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('renders only the first panel when the second is omitted', () => {
      render(
        <SplitPanel.Root orientation="vertical">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>top</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      expect(screen.getByText('top')).toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });
  });

  describe('responsive orientation', () => {
    it('resolves the orientation for the active breakpoint', () => {
      const cleanup = setupMediaQueries({xs: true, sm: true, md: true});

      render(
        <SplitPanel.Root orientation={{xs: 'vertical', md: 'horizontal'}}>
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>one</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>two</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      // md is active, so the panel splits horizontally (separator runs vertically).
      expect(screen.getByRole('separator')).toHaveAttribute(
        'data-orientation',
        'horizontal'
      );

      cleanup();
    });
  });

  describe('divider accessibility', () => {
    it('exposes separator role with orientation and value attributes', () => {
      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('aria-orientation', 'vertical');
      expect(separator).toHaveAttribute('aria-valuemin', '100');
      expect(separator).toHaveAttribute('aria-valuemax', '600');
      expect(separator).toHaveAttribute('tabindex', '0');
    });
  });

  describe('fragments', () => {
    it('flattens a Fragment wrapping the divider and second panel', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <Fragment>
            <SplitPanel.Divider />
            <SplitPanel.Panel>
              <div>right</div>
            </SplitPanel.Panel>
          </Fragment>
        </SplitPanel.Root>
      );

      expect(screen.getByText('left')).toBeInTheDocument();
      expect(screen.getByText('right')).toBeInTheDocument();
      // The sized pane is still detected through the Fragment.
      expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '200');
      // Panels inside the Fragment are counted, so no "at most two" warning.
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('detects a sized panel nested inside a Fragment', () => {
      render(
        <SplitPanel.Root orientation="horizontal">
          <Fragment>
            <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
              <div>left</div>
            </SplitPanel.Panel>
          </Fragment>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '200');
    });
  });

  describe('resize behavior', () => {
    it('gives a sized pane its default size when it appears after a single panel', () => {
      const {rerender} = render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>video</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();

      rerender(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>video</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>focus</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '200');
    });

    it('double-click resets to defaultSize, not the controlled size', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel.Root orientation="horizontal" onResizeEnd={onResizeEnd}>
          <SplitPanel.Panel defaultSize={200} size={400} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      const separator = screen.getByRole('separator');
      // Controlled `size` seeds the current value.
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

    it('never clamps max below min when the container is narrower than minSize', () => {
      // Drive a container narrower than `minSize` so the container-size cap
      // would otherwise push `max` below `min`.
      const clientWidth = jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(50);

      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );

      const separator = screen.getByRole('separator');
      expect(separator).toHaveAttribute('aria-valuemin', '100');
      // `max` is floored at `min` rather than the 50px container width.
      expect(separator).toHaveAttribute('aria-valuemax', '100');

      clientWidth.mockRestore();
    });

    it('fires onResizeEnd on keyboard resize so the size can be persisted', async () => {
      const onResizeEnd = jest.fn();
      render(
        <SplitPanel.Root orientation="horizontal" onResizeEnd={onResizeEnd}>
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
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

  describe('dev warnings', () => {
    it('warns when more than two <SplitPanel.Panel> children are rendered', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={100}>
            <div>a</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>b</div>
          </SplitPanel.Panel>
          <SplitPanel.Panel>
            <div>c</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('at most two'));
      spy.mockRestore();
    });

    it('warns when multiple panels declare defaultSize', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={100}>
            <div>a</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel defaultSize={200}>
            <div>b</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('only one <SplitPanel.Panel> may declare')
      );
      spy.mockRestore();
    });
  });
});
