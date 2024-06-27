import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ClippedBox from 'sentry/components/clippedBox';

function Child({height}: {height: number}) {
  return <div style={{height}} />;
}

class MockResizeObserver {
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
  disconnect() {}
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
      // @ts-expect-error override readonly property
      window.ResizeObserver = enableResizeObserver ? MockResizeObserver : undefined;
    });

    afterEach(() => {
      // @ts-expect-error override readonly property
      window.ResizeObserver = null;
      clearMockGetBoundingClientRect();
    });

    it('calls onSetRenderHeight once', () => {
      if (!enableResizeObserver) {
        mockGetBoundingClientRect({height: 100});
      }

      const onSetRenderHeight = jest.fn();
      const {rerender} = render(
        <ClippedBox clipHeight={50} onSetRenderedHeight={onSetRenderHeight}>
          <Child height={100} />
        </ClippedBox>
      );

      expect(onSetRenderHeight).toHaveBeenCalledTimes(1);
      rerender(
        <ClippedBox clipHeight={50} onSetRenderedHeight={onSetRenderHeight}>
          <Child height={100} />
        </ClippedBox>
      );

      expect(onSetRenderHeight).toHaveBeenCalledTimes(1);
      expect(onSetRenderHeight).toHaveBeenCalledWith(100);
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
