import {createRef} from 'react';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {Sticky} from './sticky';

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
    expect(observerOptions.at(-1)?.root).toBeNull();
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

  it('sticks relative to its scroll container instead of the top bar', () => {
    render(
      <div role="region" aria-label="Preview" style={{overflowY: 'auto'}}>
        <Sticky relativeTo="scrollContainer" topOffset={16}>
          Sticky content
        </Sticky>
      </div>
    );

    const sticky = screen.getByText('Sticky content');
    const scrollContainer = screen.getByRole('region', {name: 'Preview'});

    // The global getComputedStyle stub only reads inline styles.
    const rules = Array.from(document.styleSheets).flatMap(sheet =>
      Array.from(sheet.cssRules)
    );
    expect(
      rules.some(
        rule =>
          rule instanceof CSSStyleRule &&
          sticky.matches(rule.selectorText) &&
          rule.style.getPropertyValue('top') === '16px'
      )
    ).toBe(true);
    expect(observerOptions.at(-1)?.root).toBe(scrollContainer);
    expect(observerOptions.at(-1)?.rootMargin).toBe('-17px 0px 0px 0px');
  });
});
