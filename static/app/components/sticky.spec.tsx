import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {Sticky} from 'sentry/components/sticky';

describe('Sticky', () => {
  const originalIntersectionObserver = window.IntersectionObserver;
  let observerCallback: IntersectionObserverCallback;
  const observe = jest.fn();

  beforeEach(() => {
    observe.mockReset();
    window.IntersectionObserver = class MockIntersectionObserver {
      root = null;
      rootMargin = '';
      scrollMargin = '';
      thresholds = [];
      disconnect = jest.fn();
      observe = observe;
      takeRecords = jest.fn();
      unobserve = jest.fn();

      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
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
});
