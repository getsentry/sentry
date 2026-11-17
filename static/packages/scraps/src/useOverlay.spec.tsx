import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';

import {PositionWrapper} from '@sentry/scraps/overlay';
import {useOverlay} from '@sentry/scraps/useOverlay';

jest.unmock('@floating-ui/react-dom');

const renderContent = jest.fn();

function Content() {
  renderContent();
  return <div>Content</div>;
}

function Overlay({isOpen}: {isOpen: boolean}) {
  const {triggerProps, overlayProps} = useOverlay({
    isOpen,
    position: 'bottom',
    offset: 0,
  });
  return (
    <div>
      <button {...triggerProps}>Trigger</button>
      <PositionWrapper {...overlayProps} data-test-id="overlay">
        <Content />
      </PositionWrapper>
    </div>
  );
}

describe('useOverlay', () => {
  let triggerTop = 100;

  beforeEach(() => {
    triggerTop = 100;
    renderContent.mockClear();
    jest.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    jest.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const rect =
        this.tagName === 'BUTTON'
          ? {top: triggerTop, left: 10, width: 100, height: 20}
          : {top: 0, left: 0, width: 0, height: 0};
      return {
        ...rect,
        x: rect.left,
        y: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        toJSON: () => rect,
      };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('follows the trigger once a controlled overlay opens', async () => {
    const {rerender} = render(<Overlay isOpen={false} />);
    const overlay = screen.getByTestId('overlay');
    await act(async () => {});
    const closedTop = overlay.style.top;

    triggerTop = 200;
    fireEvent(window, new Event('resize'));
    await act(async () => {});
    expect(overlay).toHaveStyle({top: closedTop});

    rerender(<Overlay isOpen />);
    await waitFor(() => expect(overlay).toHaveStyle({top: '220px'}));

    triggerTop = 300;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(overlay).toHaveStyle({top: '320px'}));
  });

  it('does not re-render the content when the position changes', async () => {
    render(<Overlay isOpen />);
    const overlay = screen.getByTestId('overlay');
    await waitFor(() => expect(overlay).toHaveStyle({top: '120px'}));
    const renders = renderContent.mock.calls.length;

    triggerTop = 300;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(overlay).toHaveStyle({top: '320px'}));

    expect(renderContent).toHaveBeenCalledTimes(renders);
  });

  it('reports an overlay that is not rendered with PositionWrapper', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    function Unpositioned() {
      const {overlayProps} = useOverlay({isOpen: true});
      const {positioning: _positioning, ...props} = overlayProps;
      return <div {...props} />;
    }
    render(<Unpositioned />);

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('render the overlay with <PositionWrapper')
      )
    );
  });
});
