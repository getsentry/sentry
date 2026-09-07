import {useRef} from 'react';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {useIsInView} from './useIsInView';

let triggerIntersect: ((isIntersecting: boolean) => void) | undefined;

class MockIntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];

  constructor(callback: IntersectionObserverCallback) {
    triggerIntersect = isIntersecting =>
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
}

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useIsInView(ref);
  return <div ref={ref}>{inView ? 'in view' : 'not in view'}</div>;
}

describe('useIsInView', () => {
  const original = window.IntersectionObserver;

  beforeEach(() => {
    triggerIntersect = undefined;
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = original;
  });

  it('flips to true once the ref intersects', () => {
    render(<Harness />);

    expect(screen.getByText('not in view')).toBeInTheDocument();

    act(() => triggerIntersect!(true));

    expect(screen.getByText('in view')).toBeInTheDocument();
  });

  it('renders immediately when IntersectionObserver is unavailable', () => {
    // @ts-expect-error deleting the global to exercise the fallback path
    delete window.IntersectionObserver;

    render(<Harness />);

    expect(screen.getByText('in view')).toBeInTheDocument();
  });
});
