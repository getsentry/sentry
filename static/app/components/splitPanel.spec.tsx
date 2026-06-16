import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SplitPanel} from 'sentry/components/splitPanel';

const defaultLeftSide = {
  content: <div data-test-id="left-content">left</div>,
  default: 200,
  min: 100,
  max: 600,
};
const defaultTopSide = {
  content: <div data-test-id="top-content">top</div>,
  default: 200,
  min: 100,
  max: 600,
};

describe('SplitPanel', () => {
  describe('left/right', () => {
    it('renders left, divider, and right when right is provided', () => {
      render(
        <SplitPanel
          availableSize={1000}
          left={defaultLeftSide}
          right={<div data-test-id="right-content">right</div>}
        />
      );

      expect(screen.getByTestId('left-content')).toBeInTheDocument();
      expect(screen.getByTestId('right-content')).toBeInTheDocument();
    });

    it('omits the divider and right pane when right is null', () => {
      render(<SplitPanel availableSize={1000} left={defaultLeftSide} right={null} />);

      expect(screen.getByTestId('left-content')).toBeInTheDocument();
      expect(screen.queryByTestId('right-content')).not.toBeInTheDocument();
    });

    it('preserves DOM identity of left.content when toggling right between content and null', () => {
      const {rerender} = render(
        <SplitPanel
          availableSize={1000}
          left={defaultLeftSide}
          right={<div data-test-id="right-content">right</div>}
        />
      );

      const leftBefore = screen.getByTestId('left-content');

      rerender(<SplitPanel availableSize={1000} left={defaultLeftSide} right={null} />);

      const leftAfterCollapse = screen.getByTestId('left-content');
      expect(leftAfterCollapse).toBe(leftBefore);

      rerender(
        <SplitPanel
          availableSize={1000}
          left={defaultLeftSide}
          right={<div data-test-id="right-content">right</div>}
        />
      );

      const leftAfterExpand = screen.getByTestId('left-content');
      expect(leftAfterExpand).toBe(leftBefore);
    });
  });

  describe('top/bottom', () => {
    it('renders top, divider, and bottom when bottom is provided', () => {
      render(
        <SplitPanel
          availableSize={1000}
          top={defaultTopSide}
          bottom={<div data-test-id="bottom-content">bottom</div>}
        />
      );

      expect(screen.getByTestId('top-content')).toBeInTheDocument();
      expect(screen.getByTestId('bottom-content')).toBeInTheDocument();
    });

    it('omits the divider and bottom pane when bottom is null', () => {
      render(<SplitPanel availableSize={1000} top={defaultTopSide} bottom={null} />);

      expect(screen.getByTestId('top-content')).toBeInTheDocument();
      expect(screen.queryByTestId('bottom-content')).not.toBeInTheDocument();
    });

    it('preserves DOM identity of top.content when toggling bottom between content and null', () => {
      const {rerender} = render(
        <SplitPanel
          availableSize={1000}
          top={defaultTopSide}
          bottom={<div data-test-id="bottom-content">bottom</div>}
        />
      );

      const topBefore = screen.getByTestId('top-content');

      rerender(<SplitPanel availableSize={1000} top={defaultTopSide} bottom={null} />);

      const topAfterCollapse = screen.getByTestId('top-content');
      expect(topAfterCollapse).toBe(topBefore);

      rerender(
        <SplitPanel
          availableSize={1000}
          top={defaultTopSide}
          bottom={<div data-test-id="bottom-content">bottom</div>}
        />
      );

      const topAfterExpand = screen.getByTestId('top-content');
      expect(topAfterExpand).toBe(topBefore);
    });
  });
});
