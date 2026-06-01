import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SplitPanel} from 'sentry/components/splitPanel';

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

    it('makes a lone panel fill the container even when it declares defaultSize', () => {
      // A sized pane and a fill pane render with different flex styling, so
      // emotion gives them different class names. Capture both from a
      // two-panel split: the panel with `defaultSize` is sized, the other
      // fills.
      const {unmount} = render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>sized</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>fill</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );
      const sizedClass = screen.getByText('sized').parentElement!.className;
      const fillClass = screen.getByText('fill').parentElement!.className;
      expect(sizedClass).not.toEqual(fillClass);
      unmount();

      // A lone panel must fill the container even though it declares
      // `defaultSize` — it should adopt the fill styling, not the sized one.
      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>only</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );
      const loneClass = screen.getByText('only').parentElement!.className;
      expect(loneClass).toEqual(fillClass);
      expect(loneClass).not.toEqual(sizedClass);
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
      // Start as a single (fill) panel — e.g. replay VIDEO_ONLY.
      const {rerender} = render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>video</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();

      // Expand to two panels on the same mount. The sized pane must adopt its
      // defaultSize instead of staying stuck at 0.
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

    it('clamps a sized pane to max so it cannot overflow the fill pane', () => {
      // defaultSize (500) exceeds maxSize (300): the rendered basis must clamp
      // to 300, so it ends up styled identically to a pane that declares 300.
      const {unmount} = render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={500} minSize={100} maxSize={300}>
            <div>over</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>fill</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );
      const clampedClass = screen.getByText('over').parentElement!.className;
      unmount();

      render(
        <SplitPanel.Root orientation="horizontal">
          <SplitPanel.Panel defaultSize={300} minSize={100} maxSize={100000}>
            <div>exact</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>fill</div>
          </SplitPanel.Panel>
        </SplitPanel.Root>
      );
      const exactClass = screen.getByText('exact').parentElement!.className;

      expect(clampedClass).toEqual(exactClass);
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
