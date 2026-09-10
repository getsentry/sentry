import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {useAnnounceAutofixResult} from 'sentry/components/events/autofix/autofixResultStore';
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

/**
 * Stands in for an autofix embed in the chat, so tests announce results the
 * same way the embeds do rather than reaching into the store.
 */
function FakeEmbed({
  groupId,
  step,
  isComplete,
}: {
  groupId: string;
  isComplete: boolean;
  step: string;
}) {
  useAnnounceAutofixResult(groupId, step, isComplete);
  return null;
}

interface RenderOptions {
  groupId: string;
  isComplete?: boolean;
  step?: string;
}

function renderPage({groupId, step = 'root_cause', isComplete = false}: RenderOptions) {
  return render(
    <div>
      <ScrollToAutofixButton groupId={groupId} />
      <div id={SectionKey.SEER}>Seer Autofix</div>
      <FakeEmbed groupId={groupId} step={step} isComplete={isComplete} />
    </div>
  );
}

// The store dedupes announcements per issue and step for the life of the page,
// so each test uses its own issue id rather than resetting module state.
describe('ScrollToAutofixButton', () => {
  beforeEach(() => {
    installIntersectionObserver();
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 0;
    });
  });

  it('stays hidden while the step is still processing', () => {
    renderPage({groupId: 'processing'});

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers to scroll down when a completed step is below the viewport', async () => {
    const {rerender} = renderPage({groupId: 'below'});
    rerender(
      <div>
        <ScrollToAutofixButton groupId="below" />
        <div id={SectionKey.SEER}>Seer Autofix</div>
        <FakeEmbed groupId="below" step="root_cause" isComplete />
      </div>
    );
    reportPosition('below');

    const button = await screen.findByRole('button', {name: 'Scroll down to Autofix'});
    const scrollIntoView = jest.fn();
    document.getElementById(SectionKey.SEER)!.scrollIntoView = scrollIntoView;

    await userEvent.click(button);

    expect(scrollIntoView).toHaveBeenCalledWith({block: 'start', behavior: 'smooth'});
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers to scroll up when autofix is above the viewport', async () => {
    renderPage({groupId: 'above', isComplete: true});
    reportPosition('above');

    expect(
      await screen.findByRole('button', {name: 'Scroll up to Autofix'})
    ).toBeInTheDocument();
  });

  it('stays hidden when autofix is already on screen', () => {
    renderPage({groupId: 'onscreen', isComplete: true});
    reportPosition('onScreen');

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ignores a step that completed for another issue', () => {
    render(
      <div>
        <ScrollToAutofixButton groupId="watched" />
        <div id={SectionKey.SEER}>Seer Autofix</div>
        <FakeEmbed groupId="other" step="root_cause" isComplete />
      </div>
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('announces a completed step only once, however often the embed remounts', () => {
    const {rerender} = renderPage({groupId: 'remount', isComplete: true});
    reportPosition('onScreen');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    // A remount is what streaming does to an embed; it is not fresh news.
    rerender(
      <div>
        <ScrollToAutofixButton groupId="remount" />
        <div id={SectionKey.SEER}>Seer Autofix</div>
        <FakeEmbed key="second" groupId="remount" step="root_cause" isComplete />
      </div>
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('returns when a later step completes', async () => {
    renderPage({groupId: 'later', isComplete: true});
    reportPosition('onScreen');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    render(
      <div>
        <ScrollToAutofixButton groupId="later" />
        <div id={SectionKey.SEER}>Seer Autofix</div>
        <FakeEmbed groupId="later" step="solution" isComplete />
      </div>
    );
    reportPosition('below');

    expect(
      await screen.findAllByRole('button', {name: 'Scroll down to Autofix'})
    ).not.toHaveLength(0);
  });
});
