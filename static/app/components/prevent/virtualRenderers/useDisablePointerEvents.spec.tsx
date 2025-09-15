import {useRef} from 'react';

// Because of the way that userEvent works, we're unable to use it for these tests, and
// require the use of fireEvent instead.
import {fireEvent, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useDisablePointerEvents} from 'sentry/components/prevent/virtualRenderers/useDisablePointerEvents';

window.requestAnimationFrame = cb => {
  cb(1);
  return 1;
};
window.cancelAnimationFrame = () => {};

function TestComponent() {
  const elementRef = useRef<HTMLDivElement>(null);
  useDisablePointerEvents(elementRef);

  return <div ref={elementRef} data-test-id="virtual-file-renderer" />;
}

describe('useDisablePointerEvents', () => {
  describe('toggling pointer events', () => {
    let requestAnimationFrameSpy: jest.SpyInstance<number, [FrameRequestCallback]>;
    let cancelAnimationFrameSpy: jest.SpyInstance<void, [number]>;
    let dateNowSpy: jest.SpyInstance<number>;

    beforeEach(() => {
      requestAnimationFrameSpy = jest.spyOn(window, 'requestAnimationFrame');
      cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame');
      dateNowSpy = jest.spyOn(Date, 'now');
    });

    afterEach(() => {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
      dateNowSpy.mockRestore();
      jest.clearAllMocks();
    });

    it('disables pointer events on scroll and resets after timeout', async () => {
      dateNowSpy.mockImplementationOnce(() => 1000).mockImplementationOnce(() => 2000);
      requestAnimationFrameSpy.mockImplementation((cb: any) => {
        setTimeout(() => {
          cb();
        }, 50);
        return 1;
      });

      render(<TestComponent />);

      fireEvent.scroll(window, {target: {scrollX: 100}});

      const codeRenderer = screen.getByTestId('virtual-file-renderer');
      await waitFor(() => expect(codeRenderer).toHaveStyle('pointer-events: none'));
      await waitFor(() => expect(codeRenderer).toHaveStyle('pointer-events: auto'));
    });

    it('calls cancelAnimationFrame', async () => {
      dateNowSpy.mockImplementationOnce(() => 1000).mockImplementationOnce(() => 2000);
      requestAnimationFrameSpy.mockImplementation((cb: any) => {
        setTimeout(() => {
          cb();
        }, 50);
        return 1;
      });

      const {container} = render(<TestComponent />);

      fireEvent.scroll(window, {target: {scrollX: 100}});

      // eslint-disable-next-line testing-library/no-container
      container.remove();
      fireEvent.scroll(window, {target: {scrollX: 100}});
      fireEvent.scroll(window, {target: {scrollX: 100}});

      await waitFor(() => expect(cancelAnimationFrameSpy).toHaveBeenCalled());
    });
  });
});
