import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useIsOverflowing} from './useIsOverflowing';

const mocks = {scrollWidth: 0, clientWidth: 0};

class ResizeObserverMock {
  callback = (_x: any) => null;

  constructor(callback: any) {
    this.callback = callback;
  }

  observe() {
    this.callback([
      {
        contentRect: {width: 100},
        target: {
          scrollWidth: mocks.scrollWidth,
          clientWidth: mocks.clientWidth,
          getBoundingClientRect: () => ({top: 100}),
        },
      },
    ]);
  }
  unobserve() {
    // do nothing
  }
  disconnect() {
    // do nothing
  }
}
global.window.ResizeObserver = ResizeObserverMock;

describe('useIsOverflowing', () => {
  describe('ref is null', () => {
    it('returns false if the ref is null', () => {
      const {result} = renderHook(useIsOverflowing, {initialProps: {current: null}});
      expect(result.current).toBe(false);
    });
  });

  describe('ref is set', () => {
    describe('not overflowing', () => {
      beforeEach(() => {
        mocks.scrollWidth = 100;
        mocks.clientWidth = 100;
      });

      it('returns false', () => {
        // @ts-expect-error - testing ref not being null
        const {result} = renderHook(useIsOverflowing, {initialProps: {current: {}}});
        expect(result.current).toBe(false);
      });
    });

    describe('overflowing', () => {
      beforeEach(() => {
        mocks.scrollWidth = 200;
        mocks.clientWidth = 100;
      });

      it('returns true', () => {
        // @ts-expect-error - testing ref not being null
        const {result} = renderHook(useIsOverflowing, {initialProps: {current: {}}});
        expect(result.current).toBe(true);
      });
    });
  });
});
