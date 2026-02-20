import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useSyncScrollMargin} from './useSyncScrollMargin';

class ResizeObserverMock {
  callback = (_x: any) => null;

  constructor(callback: any) {
    this.callback = callback;
  }

  observe() {
    this.callback([{target: {getBoundingClientRect: () => ({top: 100})}}]);
  }
  unobserve() {
    // do nothing
  }
  disconnect() {
    // do nothing
  }
}
global.window.ResizeObserver = ResizeObserverMock;

describe('useSyncScrollMargin', () => {
  describe('overlayRef is null', () => {
    it('returns undefined', () => {
      const {result} = renderHook(useSyncScrollMargin, {initialProps: {current: null}});

      expect(result.current).toBeUndefined();
    });
  });

  describe('overlayRef is set', () => {
    it('returns the scroll margin', () => {
      const {result} = renderHook(useSyncScrollMargin, {
        initialProps: {current: {} as HTMLDivElement},
      });

      expect(result.current).toBe(100);
    });
  });
});
