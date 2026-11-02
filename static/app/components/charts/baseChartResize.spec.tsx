import {createRef} from 'react';
import type ReactEchartsCore from 'echarts-for-react/lib/core';

import {act, render} from 'sentry-test/reactTestingLibrary';

import {BaseChart} from 'sentry/components/charts/baseChart';

const getEchartsInstance = jest.fn();

jest.mock('echarts-for-react/lib/core', () => {
  // `jest.mock` is hoisted above imports, so `React` must be required here
  const ReactActual = require('react');

  return class extends ReactActual.Component {
    ele: HTMLElement | null = null;

    getEchartsInstance() {
      // Mirrors echarts' `getInstanceByDom`, which throws for a null element
      if (this.ele === null) {
        throw new TypeError('can\'t access property "getAttribute", t is null');
      }
      return getEchartsInstance();
    }

    render() {
      return (
        <div
          ref={(el: HTMLElement | null) => {
            this.ele = el;
          }}
        />
      );
    }
  };
});

describe('BaseChart resize handling', () => {
  let resizeCallback: (() => void) | null = null;
  let frames: FrameRequestCallback[] = [];
  const originalResizeObserver = window.ResizeObserver;

  beforeEach(() => {
    resizeCallback = null;
    frames = [];
    getEchartsInstance.mockReset();
    window.ResizeObserver = class {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
    jest.restoreAllMocks();
  });

  function flushFrames() {
    const pending = frames;
    frames = [];
    act(() => pending.forEach(frame => frame(0)));
  }

  it('does not look up the echarts instance once the chart element is detached', () => {
    const ref = createRef<ReactEchartsCore>();
    render(<BaseChart ref={ref} />);

    // Simulate the chart's DOM element being detached while a resize is pending
    act(() => resizeCallback?.());
    (ref.current as unknown as {ele: HTMLElement | null}).ele = null;

    expect(() => flushFrames()).not.toThrow();
    expect(getEchartsInstance).not.toHaveBeenCalled();
  });

  it('does not run a pending resize after unmount', () => {
    const {unmount} = render(<BaseChart />);

    act(() => resizeCallback?.());
    unmount();

    expect(() => flushFrames()).not.toThrow();
    expect(getEchartsInstance).not.toHaveBeenCalled();
  });

  it('resizes the chart while mounted', () => {
    const resize = jest.fn();
    getEchartsInstance.mockReturnValue({
      isDisposed: () => false,
      getDom: () => ({clientWidth: 100, clientHeight: 50}),
      resize,
    });
    render(<BaseChart />);

    act(() => resizeCallback?.());
    flushFrames();

    expect(resize).toHaveBeenCalledWith({width: 'auto', height: 'auto'});
  });
});
