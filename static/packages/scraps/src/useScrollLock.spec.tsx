import {renderHook} from '@testing-library/react';

import {useScrollLock} from './useScrollLock';

describe('useScrollLock', () => {
  let container: HTMLElement;

  beforeEach(() => {
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    container = document.createElement('div');
    container.style.overflow = 'auto';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.restoreAllMocks();
  });

  it('locks scroll when acquired', () => {
    const {result} = renderHook(() => useScrollLock(container));

    expect(container).toHaveStyle({overflow: 'auto'});

    result.current.acquire();

    expect(container).toHaveStyle({overflow: 'hidden'});
  });

  it('restores original overflow style when released', () => {
    const {result} = renderHook(() => useScrollLock(container));

    result.current.acquire();
    expect(container).toHaveStyle({overflow: 'hidden'});

    result.current.release();
    expect(container).toHaveStyle({overflow: 'auto'});
  });

  it('should use reference counting for multiple acquires from same instance', () => {
    const {result} = renderHook(() => useScrollLock(container));

    result.current.acquire();
    result.current.acquire();
    result.current.acquire();

    expect(container).toHaveStyle({overflow: 'hidden'});

    // Release and acquire are idemptotent operations, so we expect this to release
    // the lock regardless of how many times it was acquired.
    result.current.release();
    expect(container).toHaveStyle({overflow: 'auto'});
  });

  it('should use reference counting across multiple hook instances', () => {
    const {result: result1} = renderHook(() => useScrollLock(container));
    const {result: result2} = renderHook(() => useScrollLock(container));

    result1.current.acquire();
    expect(container).toHaveStyle({overflow: 'hidden'});

    result2.current.acquire();
    expect(container).toHaveStyle({overflow: 'hidden'});

    // First release should not restore overflow
    result1.current.release();
    expect(container).toHaveStyle({overflow: 'hidden'});

    // Second release should restore overflow
    result2.current.release();
    expect(container).toHaveStyle({overflow: 'auto'});
  });

  it('automatically releases lock on unmount', () => {
    const {result, unmount} = renderHook(() => useScrollLock(container));

    result.current.acquire();
    expect(container).toHaveStyle({overflow: 'hidden'});

    unmount();
    expect(container).toHaveStyle({overflow: 'auto'});
  });

  it('should handle multiple components unmounting in different orders', () => {
    const {result: result1, unmount: unmount1} = renderHook(() =>
      useScrollLock(container)
    );
    const {result: result2, unmount: unmount2} = renderHook(() =>
      useScrollLock(container)
    );
    const {result: result3, unmount: unmount3} = renderHook(() =>
      useScrollLock(container)
    );

    result1.current.acquire();
    result2.current.acquire();
    result3.current.acquire();

    expect(container).toHaveStyle({overflow: 'hidden'});

    // Unmount in random order
    unmount2();
    expect(container).toHaveStyle({overflow: 'hidden'});

    unmount1();
    expect(container).toHaveStyle({overflow: 'hidden'});

    unmount3();
    expect(container).toHaveStyle({overflow: 'auto'});
  });

  it('should support multiple containers independently', () => {
    const container2 = document.createElement('div');
    container2.style.overflow = 'scroll';
    document.body.appendChild(container2);

    const {result: result1} = renderHook(() => useScrollLock(container));
    const {result: result2} = renderHook(() => useScrollLock(container2));

    result1.current.acquire();
    expect(container).toHaveStyle({overflow: 'hidden'});
    expect(container2).toHaveStyle({overflow: 'scroll'});

    result2.current.acquire();
    expect(container).toHaveStyle({overflow: 'hidden'});
    expect(container2).toHaveStyle({overflow: 'hidden'});

    result1.current.release();
    expect(container).toHaveStyle({overflow: 'auto'});
    expect(container2).toHaveStyle({overflow: 'hidden'});

    result2.current.release();
    expect(container).toHaveStyle({overflow: 'auto'});
    expect(container2).toHaveStyle({overflow: 'scroll'});

    document.body.removeChild(container2);
  });

  it('should handle acquire after release', () => {
    const {result} = renderHook(() => useScrollLock(container));

    result.current.acquire();
    expect(container).toHaveStyle({overflow: 'hidden'});

    result.current.release();
    expect(container).toHaveStyle({overflow: 'auto'});

    result.current.acquire();
    expect(container).toHaveStyle({overflow: 'hidden'});

    result.current.release();
    expect(container).toHaveStyle({overflow: 'auto'});
  });

  describe('document.body', () => {
    // A fixed body gives back the width of the root scrollbar, and the page's
    // scroll position drops to 0 until something scrolls it again.
    function mockBrowserLayout({scrollY = 0, scrollbarWidth = 0} = {}) {
      let currentScrollY = scrollY;
      const isLocked = () => document.body.style.position === 'fixed';
      jest
        .spyOn(document.documentElement, 'clientWidth', 'get')
        .mockImplementation(() => (isLocked() ? 1200 : 1200 - scrollbarWidth));
      jest.spyOn(window, 'scrollY', 'get').mockImplementation(() => {
        if (isLocked()) {
          currentScrollY = 0;
        }
        return currentScrollY;
      });
      jest.mocked(window.scrollTo).mockImplementation((...args: unknown[]) => {
        if (typeof args[1] === 'number') {
          currentScrollY = args[1];
        }
      });
    }

    afterEach(() => {
      document.body.removeAttribute('style');
      document.documentElement.removeAttribute('style');
    });

    it('locks document scroll without changing html overflow', () => {
      mockBrowserLayout({scrollY: 240, scrollbarWidth: 20});
      const {result} = renderHook(() => useScrollLock(document.body));

      result.current.acquire();

      expect(document.documentElement).toHaveStyle({overflow: ''});
      expect(document.body).toHaveStyle({
        position: 'fixed',
        top: '-240px',
        left: '0',
        right: '0',
        width: '100%',
        paddingRight: '20px',
      });

      result.current.release();

      expect(document.body).not.toHaveStyle({position: 'fixed'});
      expect(document.body).not.toHaveStyle({top: '-240px'});
      expect(document.body).not.toHaveStyle({paddingRight: '20px'});
      expect(window.scrollTo).toHaveBeenCalledWith(0, 240);
    });

    it('preserves existing body paddingRight', () => {
      mockBrowserLayout({scrollbarWidth: 20});
      document.body.style.paddingRight = '10px';
      const {result} = renderHook(() => useScrollLock(document.body));

      result.current.acquire();
      expect(document.body).toHaveStyle({paddingRight: '30px'});

      result.current.release();
      expect(document.body).toHaveStyle({paddingRight: '10px'});
    });

    it('measures the scrollbar from layout widths, not innerWidth', () => {
      // On iOS a pinch zoom shrinks innerWidth to the visual viewport.
      jest.spyOn(window, 'innerWidth', 'get').mockReturnValue(195);
      mockBrowserLayout();
      const {result} = renderHook(() => useScrollLock(document.body));

      result.current.acquire();

      expect(document.body).toHaveStyle({paddingRight: '0px'});
      expect(document.documentElement.style.getPropertyValue('--scrollbar-size')).toBe(
        '0px'
      );
      result.current.release();
    });

    it('keeps the scroll position when one lock replaces another', () => {
      mockBrowserLayout({scrollY: 800});
      const first = renderHook(() => useScrollLock(document.body));
      const second = renderHook(() => useScrollLock(document.body));

      first.result.current.acquire();
      expect(window.scrollY).toBe(0);
      first.result.current.release();
      second.result.current.acquire();

      expect(document.body).toHaveStyle({top: '-800px'});
      second.result.current.release();
    });

    it('shares one lock after an idle instance unmounts', () => {
      mockBrowserLayout();
      const modal = renderHook(() => useScrollLock(document.body));
      const list = renderHook(() => useScrollLock(document.body));
      list.unmount();
      const navigation = renderHook(() => useScrollLock(document.body));

      navigation.result.current.acquire();
      modal.result.current.acquire();
      navigation.result.current.release();
      expect(document.body).toHaveStyle({position: 'fixed'});

      modal.result.current.release();
      expect(document.body).not.toHaveStyle({position: 'fixed'});
    });
  });
});
