import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useScrollLock} from './useScrollLock';

describe('useScrollLock', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.overflow = 'auto';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
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

  it('locks document scroll without changing html overflow', () => {
    const scrollX = 100;
    const scrollY = 240;
    const originalInnerWidth = window.innerWidth;
    const originalClientWidth = document.body.clientWidth;
    const originalScrollX = window.scrollX;
    const originalScrollY = window.scrollY;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(document.body, 'clientWidth', {
      configurable: true,
      value: 1180,
    });
    Object.defineProperty(window, 'scrollX', {
      configurable: true,
      value: scrollX,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: scrollY,
    });
    const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    const {result} = renderHook(() => useScrollLock(document.body));

    result.current.acquire();

    expect(document.documentElement).toHaveStyle({overflow: ''});
    expect(document.body).toHaveStyle({
      position: 'fixed',
      top: `-${scrollY}px`,
      left: '0',
      right: '0',
      width: '100%',
      paddingRight: '20px',
    });

    result.current.release();

    expect(document.body).toHaveStyle({position: ''});
    expect(document.body).toHaveStyle({top: ''});
    expect(document.body).toHaveStyle({left: ''});
    expect(document.body).toHaveStyle({right: ''});
    expect(document.body).toHaveStyle({width: ''});
    expect(document.body).toHaveStyle({paddingRight: ''});
    expect(scrollToSpy).toHaveBeenCalledWith(scrollX, scrollY);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(document.body, 'clientWidth', {
      configurable: true,
      value: originalClientWidth,
    });
    Object.defineProperty(window, 'scrollX', {
      configurable: true,
      value: originalScrollX,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: originalScrollY,
    });
    scrollToSpy.mockRestore();
  });

  it('preserves existing body paddingRight when locking document scroll', () => {
    const originalInnerWidth = window.innerWidth;
    const originalClientWidth = document.body.clientWidth;
    const originalScrollY = window.scrollY;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(document.body, 'clientWidth', {
      configurable: true,
      value: 1180,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    });
    const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

    // Set existing paddingRight on body
    document.body.style.paddingRight = '10px';

    const {result} = renderHook(() => useScrollLock(document.body));

    result.current.acquire();

    // scrollbar (20px) + existing padding (10px) = 30px
    expect(document.body).toHaveStyle({paddingRight: '30px'});

    result.current.release();

    // Original paddingRight is restored
    expect(document.body).toHaveStyle({paddingRight: '10px'});

    document.body.style.paddingRight = '';
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(document.body, 'clientWidth', {
      configurable: true,
      value: originalClientWidth,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: originalScrollY,
    });
    scrollToSpy.mockRestore();
  });
});
