import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useSyncWrapperWidth} from './useSyncWrapperWidth';

class ResizeObserverMock {
  callback = (_x: any) => null;

  constructor(callback: any) {
    this.callback = callback;
  }

  observe() {
    this.callback([{contentRect: {width: 100}}]);
  }
  unobserve() {
    // do nothing
  }
  disconnect() {
    // do nothing
  }
}
global.window.ResizeObserver = ResizeObserverMock;

describe('useSyncWrapperWidth', () => {
  describe('wrapperRefState is null', () => {
    it('returns the wrapper width as 100%', () => {
      const {result} = renderHook(useSyncWrapperWidth);

      expect(result.current.wrapperWidth).toBe('100%');
    });
  });

  describe('wrapperRefState is set', () => {
    it('returns the wrapper width from the ResizeObserver entry', () => {
      const {result} = renderHook(useSyncWrapperWidth);

      act(() => {
        result.current.setWrapperRefState({} as HTMLDivElement);
      });

      expect(result.current.wrapperWidth).toBe('100px');
    });
  });
});
