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
});
