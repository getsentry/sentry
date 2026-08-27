import type {ReactNode} from 'react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useAutoScroll} from 'sentry/utils/useAutoScroll';

function ScrollContainer({
  children,
  contentKey,
}: {
  children: ReactNode;
  contentKey: unknown;
}) {
  const {containerRef, onScrollHandler} = useAutoScroll({key: contentKey});

  return (
    <div data-test-id="container" ref={containerRef} onScroll={onScrollHandler}>
      {children}
    </div>
  );
}

describe('useAutoScroll', () => {
  let scrollToSpy!: jest.Mock;

  beforeEach(() => {
    scrollToSpy = jest.fn();
    // jsdom does not implement Element.prototype.scrollTo
    Object.defineProperty(Element.prototype, 'scrollTo', {
      value: scrollToSpy,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error removing the jsdom stub added above
    delete Element.prototype.scrollTo;
  });

  it('scrolls to the bottom when the key changes', async () => {
    const {rerender} = render(<ScrollContainer contentKey="a">short</ScrollContainer>);

    await waitFor(() => expect(scrollToSpy).toHaveBeenCalled());
    scrollToSpy.mockClear();

    rerender(<ScrollContainer contentKey="b">short</ScrollContainer>);

    await waitFor(() => expect(scrollToSpy).toHaveBeenCalled());
  });

  it('re-scrolls when content grows after the key last changed', async () => {
    const {rerender} = render(
      <ScrollContainer contentKey="stable">
        <p>placeholder</p>
      </ScrollContainer>
    );

    await waitFor(() => expect(scrollToSpy).toHaveBeenCalled());
    scrollToSpy.mockClear();

    // The autofix drawer swaps placeholders for real content once a *separate*
    // query resolves, so the content grows without `key` ever changing again.
    rerender(
      <ScrollContainer contentKey="stable">
        <p>real content</p>
        <p>more real content</p>
      </ScrollContainer>
    );

    await screen.findByText('more real content');
    await waitFor(() => expect(scrollToSpy).toHaveBeenCalled());
  });

  it('does not disarm when a smooth scroll emits intermediate events', async () => {
    const {rerender} = render(<ScrollContainer contentKey="a">content</ScrollContainer>);

    await waitFor(() => expect(scrollToSpy).toHaveBeenCalled());

    const container = screen.getByTestId('container');
    Object.defineProperty(container, 'scrollHeight', {value: 1000, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 100, configurable: true});

    // Mid-animation position: moving down, but not at the bottom yet.
    Object.defineProperty(container, 'scrollTop', {value: 400, configurable: true});
    container.dispatchEvent(new Event('scroll', {bubbles: true}));

    scrollToSpy.mockClear();
    rerender(<ScrollContainer contentKey="b">content</ScrollContainer>);

    await waitFor(() => expect(scrollToSpy).toHaveBeenCalled());
  });

  it('stops auto-scrolling once the user scrolls up', async () => {
    const {rerender} = render(<ScrollContainer contentKey="a">content</ScrollContainer>);

    await waitFor(() => expect(scrollToSpy).toHaveBeenCalled());

    const container = screen.getByTestId('container');
    Object.defineProperty(container, 'scrollHeight', {value: 1000, configurable: true});
    Object.defineProperty(container, 'clientHeight', {value: 100, configurable: true});

    // Settle at the bottom, then scroll back up.
    Object.defineProperty(container, 'scrollTop', {value: 900, configurable: true});
    container.dispatchEvent(new Event('scroll', {bubbles: true}));
    Object.defineProperty(container, 'scrollTop', {value: 200, configurable: true});
    container.dispatchEvent(new Event('scroll', {bubbles: true}));

    scrollToSpy.mockClear();
    rerender(<ScrollContainer contentKey="b">content</ScrollContainer>);

    await waitFor(() => expect(scrollToSpy).not.toHaveBeenCalled());
  });
});
