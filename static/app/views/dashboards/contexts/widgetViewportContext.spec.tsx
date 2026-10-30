import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useWidgetViewportVisibility} from 'sentry/views/dashboards/contexts/widgetViewportContext';

describe('useWidgetViewportVisibility', () => {
  const originalIntersectionObserver = window.IntersectionObserver;
  let triggerIntersection: (isIntersecting: boolean) => void;
  let observerOptions: IntersectionObserverInit | undefined;

  beforeEach(() => {
    window.IntersectionObserver = class {
      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        observerOptions = options;
        triggerIntersection = isIntersecting =>
          callback(
            [{isIntersecting} as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          );
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  const ref = {current: document.createElement('div')};

  it('keeps tracking visibility after the first intersection', () => {
    const {result} = renderHookWithProviders(() => useWidgetViewportVisibility({ref}));

    expect(observerOptions?.rootMargin).toBe('200px 0px');
    expect(result.current).toEqual({hasBeenInViewport: false, isInViewport: false});

    act(() => triggerIntersection(true));
    expect(result.current).toEqual({hasBeenInViewport: true, isInViewport: true});

    act(() => triggerIntersection(false));
    expect(result.current).toEqual({hasBeenInViewport: true, isInViewport: false});
  });

  it('is always visible when disabled', () => {
    const {result} = renderHookWithProviders(() =>
      useWidgetViewportVisibility({ref, disabled: true})
    );

    expect(result.current).toEqual({hasBeenInViewport: true, isInViewport: true});
  });
});
