import {Activity, useState} from 'react';

import {
  createEvent,
  fireEvent,
  render,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {ClippedBox} from 'sentry/components/clippedBox';

function Child({height}: {height: number}) {
  return <div style={{height}} />;
}

class MockResizeObserver {
  static disconnect = jest.fn();

  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  unobserve(_element: HTMLElement) {
    throw new Error('not implemented');
  }

  observe(element: HTMLElement) {
    // Executes in sync so we dont have to
    this.callback(
      [
        {
          target: element,
          contentBoxSize: [
            // @ts-expect-error partial mock
            {
              blockSize: 100,
            },
          ],
        },
      ],
      this
    );
  }
  disconnect() {
    MockResizeObserver.disconnect();
  }
}

function mockGetBoundingClientRect({height}: {height: number}) {
  window.HTMLDivElement.prototype.getBoundingClientRect = () =>
    ({
      bottom: 0,
      height,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
    }) as DOMRect;
}

function clearMockGetBoundingClientRect() {
  window.HTMLDivElement.prototype.getBoundingClientRect =
    window.HTMLElement.prototype.getBoundingClientRect;
}

describe('clipped box', () => {
  describe.each([[true], [false]])('with resize observer = %s', enableResizeObserver => {
    beforeEach(() => {
      MockResizeObserver.disconnect.mockClear();
      // @ts-expect-error override readonly property
      window.ResizeObserver = enableResizeObserver ? MockResizeObserver : undefined;
    });

    afterEach(() => {
      // @ts-expect-error override readonly property
      window.ResizeObserver = null;
      clearMockGetBoundingClientRect();
    });

    it('clips height when it exceeds clipHeight and shows button', () => {
      if (!enableResizeObserver) {
        mockGetBoundingClientRect({height: 100});
      }

      const {container} = render(
        <ClippedBox clipHeight={50} clipFlex={15}>
          <Child height={100} />
        </ClippedBox>
      );
      expect(container.firstChild).toHaveStyle('max-height: 50px');
      expect(screen.getByText(/show more/i)).toBeInTheDocument();
    });

    it('reveals contents', async () => {
      if (!enableResizeObserver) {
        mockGetBoundingClientRect({height: 100});
      }

      const onReveal = jest.fn();
      const {container} = render(
        <ClippedBox clipHeight={50} clipFlex={15} onReveal={onReveal}>
          <Child height={100} />
        </ClippedBox>
      );

      const button = screen.getByRole('button');
      await userEvent.click(button);

      expect(onReveal).toHaveBeenCalledTimes(1);
      expect(container.firstChild).toHaveStyle('max-height: 9999px');
      expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
      if (enableResizeObserver) {
        expect(MockResizeObserver.disconnect).toHaveBeenCalled();
      }
    });

    it('preserves revealed max height when Activity hides and shows it', async () => {
      if (!enableResizeObserver) {
        mockGetBoundingClientRect({height: 100});
      }

      function ActivityToggledClippedBox() {
        const [visible, setVisible] = useState(true);
        return (
          <div>
            <button onClick={() => setVisible(value => !value)}>toggle activity</button>
            <Activity mode={visible ? 'visible' : 'hidden'}>
              <ClippedBox clipHeight={50} clipFlex={15}>
                <div style={{height: 100}}>activity content</div>
              </ClippedBox>
            </Activity>
          </div>
        );
      }

      render(<ActivityToggledClippedBox />);

      const showMoreButton = screen.getByRole('button', {name: 'Show More'});
      const wrapper = screen.getByText('activity content').parentElement?.parentElement;
      expect(wrapper).toBeInstanceOf(HTMLElement);

      await userEvent.click(showMoreButton);
      // React only clears max-height after the max-height transition ends. jsdom
      // does not populate TransitionEvent.propertyName, so patch it onto the
      // event to exercise the same branch a browser would use.
      const transitionEndEvent = createEvent.transitionEnd(wrapper!);
      Object.defineProperty(transitionEndEvent, 'propertyName', {
        configurable: true,
        value: 'max-height',
      });
      fireEvent(wrapper!, transitionEndEvent);

      expect(wrapper).toHaveStyle('max-height: none');

      await userEvent.click(screen.getByRole('button', {name: 'toggle activity'}));
      await userEvent.click(screen.getByRole('button', {name: 'toggle activity'}));

      const currentWrapper =
        screen.getByText('activity content').parentElement?.parentElement;

      expect(currentWrapper).toHaveStyle('max-height: none');
      expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
    });

    it('does not clip height when it does not exceed clipHeight and does not show button', () => {
      if (!enableResizeObserver) {
        mockGetBoundingClientRect({height: 10});
      }

      render(
        <ClippedBox clipHeight={100} clipFlex={0}>
          <Child height={10} />
        </ClippedBox>
      );
      expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
    });

    it('does not show collapse button for content that was never clipped', () => {
      if (!enableResizeObserver) {
        mockGetBoundingClientRect({height: 10});
      }

      render(
        <ClippedBox clipHeight={100} clipFlex={0} collapsible>
          <Child height={10} />
        </ClippedBox>
      );
      expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/show less/i)).not.toBeInTheDocument();
    });
    it('preserves state on resize once it is open', async () => {
      if (!enableResizeObserver) {
        mockGetBoundingClientRect({height: 100});
      }

      function ToggledComponent() {
        const [height, setHeight] = useState(100);
        return (
          <div style={{height}}>
            <button onClick={() => setHeight(200)}>resize</button>
          </div>
        );
      }

      const {container} = render(
        <ClippedBox clipHeight={50} clipFlex={0}>
          <ToggledComponent />
        </ClippedBox>
      );

      const button = screen.getByRole('button', {name: 'Show More'});
      await userEvent.click(button);

      // Resize
      const resizeButton = screen.getByText(/resize/);
      await userEvent.click(resizeButton);

      expect(container.firstChild).toHaveStyle('max-height: 9999px');
      expect(screen.queryByText(/show more/i)).not.toBeInTheDocument();
    });
  });
});
