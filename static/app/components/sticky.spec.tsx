import {createRef} from 'react';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {Sticky} from 'sentry/components/sticky';

describe('Sticky', () => {
  const originalIntersectionObserver = window.IntersectionObserver;
  let observerCallback: IntersectionObserverCallback;
  const observe = jest.fn();
  const observerOptions: IntersectionObserverInit[] = [];

  beforeEach(() => {
    observe.mockReset();
    observerOptions.length = 0;
    window.IntersectionObserver = class MockIntersectionObserver {
      root = null;
      rootMargin = '';
      scrollMargin = '';
      thresholds = [];
      disconnect = jest.fn();
      observe = observe;
      takeRecords = jest.fn();
      unobserve = jest.fn();

      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit
      ) {
        observerCallback = callback;
        observerOptions.push(options ?? {});
      }
    };
  });

  afterAll(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it('tracks whether the element is stuck', () => {
    render(<Sticky>Sticky content</Sticky>);

    const sticky = screen.getByText('Sticky content');
    expect(observe).toHaveBeenCalledWith(sticky);
    expect(sticky).not.toHaveAttribute('data-stuck');

    act(() => {
      observerCallback(
        [{intersectionRatio: 0} as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(sticky).toHaveAttribute('data-stuck');

    act(() => {
      observerCallback(
        [{intersectionRatio: 1} as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(sticky).not.toHaveAttribute('data-stuck');
  });

  it('supports an external ref and an additional top offset', () => {
    const ref = createRef<HTMLDivElement>();
    const {rerender} = render(<Sticky ref={ref}>Sticky content</Sticky>);

    const sticky = screen.getByText('Sticky content');
    const initialObserverOffset = Number.parseInt(
      observerOptions.at(-1)?.rootMargin?.split(' ')[0] ?? '',
      10
    );

    expect(ref.current).toBe(sticky);
    expect(initialObserverOffset).not.toBeNaN();

    rerender(
      <Sticky ref={ref} topOffset={20}>
        Sticky content
      </Sticky>
    );

    const stackedObserverOffset = Number.parseInt(
      observerOptions.at(-1)?.rootMargin?.split(' ')[0] ?? '',
      10
    );
    expect(stackedObserverOffset).not.toBeNaN();
    expect(stackedObserverOffset).toBe(initialObserverOffset - 20);
  });
});
