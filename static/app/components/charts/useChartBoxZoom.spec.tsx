import type {ECharts} from 'echarts';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useChartBoxZoom} from './useChartBoxZoom';

// jsdom has no PointerEvent; build one off MouseEvent and tack on pointerId.
function pointerEvent(
  type: string,
  {clientX = 0, clientY = 0, button = 0, pointerId = 1} = {}
) {
  const evt = new MouseEvent(type, {clientX, clientY, button, bubbles: true});
  Object.defineProperty(evt, 'pointerId', {value: pointerId});
  return evt;
}

// A real DOM node so the hook's addEventListener/dispatchEvent path works, plus
// the pointer-capture + layout stubs jsdom doesn't implement. The plot area is
// 0,0 -> 500,500 so a press at (100, 100) lands inside it and starts a drag.
function makeChart() {
  const dom = document.createElement('div');
  dom.setPointerCapture = jest.fn();
  dom.releasePointerCapture = jest.fn();
  dom.hasPointerCapture = jest.fn().mockReturnValue(true);
  dom.getBoundingClientRect = jest
    .fn()
    .mockReturnValue({left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500});

  const chart = {
    getDom: () => dom,
    getModel: () => ({
      getComponent: (mainType: string) =>
        mainType === 'grid'
          ? {coordinateSystem: {getRect: () => ({x: 0, y: 0, width: 500, height: 500})}}
          : undefined,
    }),
    convertFromPixel: jest.fn().mockReturnValue(0),
    setOption: jest.fn(),
    dispatchAction: jest.fn(),
    isDisposed: () => false,
  } as unknown as ECharts;

  return {chart, dom};
}

describe('useChartBoxZoom', () => {
  it('does not enter drag state on a press when onZoom is not provided', () => {
    const {chart, dom} = makeChart();
    const {result} = renderHookWithProviders(() =>
      useChartBoxZoom({xAxisIndex: 1, yAxisIndex: 1})
    );

    act(() => result.current.onChartReady(chart));
    act(() => {
      dom.dispatchEvent(pointerEvent('pointerdown', {clientX: 100, clientY: 100}));
    });

    expect(result.current.isDraggingRef.current).toBe(false);
  });

  it('sets isDraggingRef on pointerdown inside the plot and clears it on pointerup', () => {
    const {chart, dom} = makeChart();
    const {result} = renderHookWithProviders(() =>
      useChartBoxZoom({onZoom: jest.fn(), xAxisIndex: 1, yAxisIndex: 1})
    );

    act(() => result.current.onChartReady(chart));

    act(() => {
      dom.dispatchEvent(pointerEvent('pointerdown', {clientX: 100, clientY: 100}));
    });
    expect(result.current.isDraggingRef.current).toBe(true);

    act(() => {
      dom.dispatchEvent(pointerEvent('pointerup', {clientX: 100, clientY: 100}));
    });
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  it('clears isDraggingRef when the drag is cancelled with Escape', () => {
    const {chart, dom} = makeChart();
    const {result} = renderHookWithProviders(() =>
      useChartBoxZoom({onZoom: jest.fn(), xAxisIndex: 1, yAxisIndex: 1})
    );

    act(() => result.current.onChartReady(chart));
    act(() => {
      dom.dispatchEvent(pointerEvent('pointerdown', {clientX: 100, clientY: 100}));
    });
    expect(result.current.isDraggingRef.current).toBe(true);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
      );
    });
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  it('clears isDraggingRef when pointer capture is lost', () => {
    const {chart, dom} = makeChart();
    const {result} = renderHookWithProviders(() =>
      useChartBoxZoom({onZoom: jest.fn(), xAxisIndex: 1, yAxisIndex: 1})
    );

    act(() => result.current.onChartReady(chart));
    act(() => {
      dom.dispatchEvent(pointerEvent('pointerdown', {clientX: 100, clientY: 100}));
    });
    expect(result.current.isDraggingRef.current).toBe(true);

    act(() => {
      dom.dispatchEvent(new Event('lostpointercapture'));
    });
    expect(result.current.isDraggingRef.current).toBe(false);
  });
});
