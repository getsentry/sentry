import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SplitPanel} from '@sentry/scraps/splitPanel';

describe('SplitPanel', () => {
  describe('horizontal orientation', () => {
    it('renders both panels and a divider', () => {
      render(
        <SplitPanel orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div data-test-id="left-content">left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div data-test-id="right-content">right</div>
          </SplitPanel.Panel>
        </SplitPanel>
      );

      expect(screen.getByTestId('left-content')).toBeInTheDocument();
      expect(screen.getByTestId('right-content')).toBeInTheDocument();
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('renders only the first panel when the second is omitted', () => {
      render(
        <SplitPanel orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div data-test-id="left-content">left</div>
          </SplitPanel.Panel>
        </SplitPanel>
      );

      expect(screen.getByTestId('left-content')).toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
      // A lone panel must fill the container, not stay at its defaultSize.
      expect(screen.getByTestId('left-content').parentElement).not.toHaveAttribute(
        'data-sized'
      );
    });

    it('preserves DOM identity of the sized panel when toggling the fill panel', () => {
      const {rerender} = render(
        <SplitPanel orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div data-test-id="left-content">left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div data-test-id="right-content">right</div>
          </SplitPanel.Panel>
        </SplitPanel>
      );

      const leftBefore = screen.getByTestId('left-content');

      rerender(
        <SplitPanel orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div data-test-id="left-content">left</div>
          </SplitPanel.Panel>
        </SplitPanel>
      );

      expect(screen.getByTestId('left-content')).toBe(leftBefore);

      rerender(
        <SplitPanel orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div data-test-id="left-content">left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div data-test-id="right-content">right</div>
          </SplitPanel.Panel>
        </SplitPanel>
      );

      expect(screen.getByTestId('left-content')).toBe(leftBefore);
    });
  });

  describe('vertical orientation', () => {
    it('renders both panels and a divider', () => {
      render(
        <SplitPanel orientation="vertical">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div data-test-id="top-content">top</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div data-test-id="bottom-content">bottom</div>
          </SplitPanel.Panel>
        </SplitPanel>
      );

      expect(screen.getByTestId('top-content')).toBeInTheDocument();
      expect(screen.getByTestId('bottom-content')).toBeInTheDocument();
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('renders only the first panel when the second is omitted', () => {
      render(
        <SplitPanel orientation="vertical">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div data-test-id="top-content">top</div>
          </SplitPanel.Panel>
        </SplitPanel>
      );

      expect(screen.getByTestId('top-content')).toBeInTheDocument();
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
      // A lone panel must fill the container, not stay at its defaultSize.
      expect(screen.getByTestId('top-content').parentElement).not.toHaveAttribute(
        'data-sized'
      );
    });
  });

  describe('divider accessibility', () => {
    it('exposes separator role with orientation and value attributes', () => {
      render(
        <SplitPanel orientation="horizontal">
          <SplitPanel.Panel defaultSize={200} minSize={100} maxSize={600}>
            <div>left</div>
          </SplitPanel.Panel>
          <SplitPanel.Divider />
          <SplitPanel.Panel>
            <div>right</div>
          </SplitPanel.Panel>
        </SplitPanel>
      );

      const separator = screen.getByRole('separator');
      // Horizontal split → vertical divider line
      expect(separator).toHaveAttribute('aria-orientation', 'vertical');
      expect(separator).toHaveAttribute('aria-valuemin', '100');
      expect(separator).toHaveAttribute('aria-valuemax', '600');
      expect(separator).toHaveAttribute('tabindex', '0');
    });
  });
});
