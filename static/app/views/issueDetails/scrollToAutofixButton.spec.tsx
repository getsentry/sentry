import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {notifyAutofixInteraction} from 'sentry/components/events/autofix/autofixInteractionStore';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {ScrollToAutofixButton} from 'sentry/views/issueDetails/scrollToAutofixButton';

/**
 * The jsdom IntersectionObserver never calls back, so tests drive it: the
 * section's position relative to the viewport is the whole trigger.
 */
let reportPosition: (position: 'onScreen' | 'above' | 'below') => void;

function installIntersectionObserver() {
  window.IntersectionObserver = class FakeIntersectionObserver {
    root = null;
    rootMargin = '';
    scrollMargin = '';
    thresholds = [];
    takeRecords = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();

    constructor(private callback: IntersectionObserverCallback) {}

    observe() {
      reportPosition = position => {
        const rootBounds = {bottom: 800, top: 0} as DOMRectReadOnly;
        act(() => {
          this.callback(
            [
              {
                isIntersecting: position === 'onScreen',
                rootBounds,
                boundingClientRect: {top: position === 'below' ? 1200 : -400} as DOMRect,
              } as IntersectionObserverEntry,
            ],
            this as unknown as IntersectionObserver
          );
        });
      };
    }
  } as unknown as typeof IntersectionObserver;
}

function renderButton(groupId = '1') {
  return render(
    <div>
      <ScrollToAutofixButton groupId={groupId} />
      <div id={SectionKey.SEER}>Seer Autofix</div>
    </div>
  );
}

describe('ScrollToAutofixButton', () => {
  beforeEach(() => {
    installIntersectionObserver();
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 0;
    });
  });

  it('stays hidden until someone interacts with an autofix embed', () => {
    renderButton();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers to scroll down when autofix is below the viewport', async () => {
    renderButton();

    act(() => notifyAutofixInteraction('1'));
    reportPosition('below');

    const button = await screen.findByRole('button', {name: 'Scroll down to Autofix'});
    const scrollIntoView = jest.fn();
    document.getElementById(SectionKey.SEER)!.scrollIntoView = scrollIntoView;

    await userEvent.click(button);

    expect(scrollIntoView).toHaveBeenCalledWith({block: 'start', behavior: 'smooth'});
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers to scroll up when autofix is above the viewport', async () => {
    renderButton();

    act(() => notifyAutofixInteraction('1'));
    reportPosition('above');

    expect(
      await screen.findByRole('button', {name: 'Scroll up to Autofix'})
    ).toBeInTheDocument();
  });

  it('stays hidden when autofix is already on screen', () => {
    renderButton();

    act(() => notifyAutofixInteraction('1'));
    reportPosition('onScreen');

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ignores interactions with another issue', () => {
    renderButton();

    act(() => notifyAutofixInteraction('2'));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('returns on a later interaction after the reader has seen the section', async () => {
    renderButton();

    act(() => notifyAutofixInteraction('1'));
    reportPosition('onScreen');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    act(() => notifyAutofixInteraction('1'));
    reportPosition('below');

    expect(
      await screen.findByRole('button', {name: 'Scroll down to Autofix'})
    ).toBeInTheDocument();
  });
});
