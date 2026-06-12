import {useRef} from 'react';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {useElementOffset} from 'sentry/utils/useElementOffset';

function rect(top: number, left: number): DOMRect {
  return {
    top,
    left,
    bottom: top,
    right: left,
    width: 0,
    height: 0,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function TestComponent() {
  const elementRef = useRef<HTMLDivElement>(null);
  const relativeToRef = useRef<HTMLDivElement>(null);
  const {top, left} = useElementOffset(elementRef, relativeToRef);

  return (
    <div ref={relativeToRef} data-role="relative">
      <div ref={elementRef} data-role="element" />
      <span data-test-id="offset">{`${top},${left}`}</span>
    </div>
  );
}

describe('useElementOffset', () => {
  let resizeCallback: ResizeObserverCallback | undefined;
  const disconnect = jest.fn();
  let elementRect = rect(0, 0);
  let relativeRect = rect(0, 0);

  beforeEach(() => {
    resizeCallback = undefined;
    elementRect = rect(0, 0);
    relativeRect = rect(0, 0);

    window.ResizeObserver = jest.fn().mockImplementation(callback => {
      resizeCallback = callback;
      return {observe: jest.fn(), unobserve: jest.fn(), disconnect};
    });

    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.role === 'element') {
          return elementRect;
        }
        if (this.dataset.role === 'relative') {
          return relativeRect;
        }
        return rect(0, 0);
      });
  });

  it('returns the offset of the element relative to the other element on mount', () => {
    elementRect = rect(120, 40);
    relativeRect = rect(50, 10);

    render(<TestComponent />);

    expect(screen.getByTestId('offset')).toHaveTextContent('70,30');
  });

  it('re-measures when the ResizeObserver fires', () => {
    elementRect = rect(120, 40);
    relativeRect = rect(50, 10);

    render(<TestComponent />);

    elementRect = rect(200, 40);
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    expect(screen.getByTestId('offset')).toHaveTextContent('150,30');
  });

  it('disconnects the observer on unmount', () => {
    const {unmount} = render(<TestComponent />);

    unmount();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
