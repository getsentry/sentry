import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ScrollCarousel} from 'sentry/components/scrollCarousel';

describe('ScrollCarousel', function () {
  let intersectionOnbserverCb: (entries: Partial<IntersectionObserverEntry>[]) => void =
    jest.fn();

  window.IntersectionObserver = class IntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds = [];
    takeRecords = jest.fn();

    constructor(cb: IntersectionObserverCallback) {
      // @ts-expect-error The callback wants just way too much stuff for our simple mock
      intersectionOnbserverCb = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  it('hides arrows if content does not overflow in x', function () {
    render(
      <ScrollCarousel aria-label="example">
        <div data-test-id="child-1" />
      </ScrollCarousel>
    );

    // Child is visible
    act(() =>
      intersectionOnbserverCb([
        {target: screen.getByTestId('child-1'), intersectionRatio: 1},
      ])
    );

    expect(screen.queryByRole('button', {name: 'Scroll left'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Scroll right'})).not.toBeInTheDocument();
  });

  it('shows right arrow when elements exist to the right', async function () {
    render(
      <ScrollCarousel aria-label="example" data-test-id="scroll">
        <div data-test-id="child-1" />
        <div data-test-id="child-2" />
        <div data-test-id="child-3" />
      </ScrollCarousel>
    );

    const scrollContainer = screen.getByTestId('scroll');
    const elements = [
      screen.getByTestId('child-1'),
      screen.getByTestId('child-2'),
      screen.getByTestId('child-3'),
    ];

    // Element on the right is not visible
    act(() =>
      intersectionOnbserverCb([
        {target: elements[0], intersectionRatio: 1},
        {target: elements[1], intersectionRatio: 0.5},
        {target: elements[2], intersectionRatio: 0},
      ])
    );

    const rightButton = screen.getByRole('button', {name: 'Scroll right'});
    expect(screen.queryByRole('button', {name: 'Scroll left'})).not.toBeInTheDocument();

    // Test scroll into view, the last element should have its 'scrollTo' called
    scrollContainer.scrollTo = jest.fn();
    await userEvent.click(rightButton);
    expect(scrollContainer.scrollTo).toHaveBeenCalled();
  });

  it('shows left arrow when elements exist to the left', async function () {
    render(
      <ScrollCarousel aria-label="example" data-test-id="scroll">
        <div data-test-id="child-1" />
        <div data-test-id="child-2" />
        <div data-test-id="child-3" />
      </ScrollCarousel>
    );

    const scrollContainer = screen.getByTestId('scroll');
    const elements = [
      screen.getByTestId('child-1'),
      screen.getByTestId('child-2'),
      screen.getByTestId('child-3'),
    ];

    // Element on the left is not visible
    act(() =>
      intersectionOnbserverCb([
        {target: elements[0], intersectionRatio: 0},
        {target: elements[1], intersectionRatio: 1},
        {target: elements[2], intersectionRatio: 1},
      ])
    );

    const leftButton = await screen.findByRole('button', {name: 'Scroll left'});
    expect(screen.queryByRole('button', {name: 'Scroll right'})).not.toBeInTheDocument();

    // Test scroll into view, the 1st element should have its 'scrollTo' called
    scrollContainer.scrollTo = jest.fn();
    await userEvent.click(leftButton);
    expect(scrollContainer.scrollTo).toHaveBeenCalled();
  });
});
