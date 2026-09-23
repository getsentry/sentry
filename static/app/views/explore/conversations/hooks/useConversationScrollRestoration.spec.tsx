import {startTransition, Suspense, use} from 'react';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {Container} from '@sentry/scraps/layout';

import type {ConversationViewTab} from 'sentry/views/explore/conversations/components/conversationView';

import {useConversationScrollRestoration} from './useConversationScrollRestoration';

function ScrollPanel({
  activeTab,
  suspend,
}: {
  activeTab: ConversationViewTab;
  suspend?: Promise<void>;
}) {
  const ref = useConversationScrollRestoration({activeTab, selectedNodeId: null});

  if (suspend) {
    use(suspend);
  }

  return <Container ref={ref} role="region" aria-label={activeTab} />;
}

function Conversation({
  activeTab,
  suspend,
}: {
  activeTab: ConversationViewTab;
  suspend?: Promise<void>;
}) {
  return (
    <Suspense fallback={<Container role="status">Loading</Container>}>
      <ScrollPanel activeTab={activeTab} suspend={suspend} />
    </Suspense>
  );
}

function scrollToOffset(container: HTMLElement, top: number) {
  act(() => {
    container.scrollTop = top;
    // jsdom has no layout or native scrolling; dispatch the browser event after
    // setting the offset so the hook observes the same sequence as a scroll.
    container.dispatchEvent(new Event('scroll'));
  });
}

describe('useConversationScrollRestoration', () => {
  it('keeps independent offsets across committed tab switches', () => {
    const {rerender} = render(<Conversation activeTab="transcript" />);
    scrollToOffset(screen.getByRole('region', {name: 'transcript'}), 120);

    rerender(<Conversation activeTab="timeline" />);
    expect(screen.getByRole('region', {name: 'timeline'}).scrollTop).toBe(0);
    scrollToOffset(screen.getByRole('region', {name: 'timeline'}), 240);

    rerender(<Conversation activeTab="transcript" />);
    expect(screen.getByRole('region', {name: 'transcript'}).scrollTop).toBe(120);

    rerender(<Conversation activeTab="timeline" />);
    expect(screen.getByRole('region', {name: 'timeline'}).scrollTop).toBe(240);
  });

  it('records scrolling against the visible tab while another tab suspends', async () => {
    const {rerender} = render(<Conversation activeTab="transcript" />);
    scrollToOffset(screen.getByRole('region', {name: 'transcript'}), 40);

    const pending = new Promise<void>(() => {});
    await act(() => {
      startTransition(() => {
        rerender(<Conversation activeTab="timeline" suspend={pending} />);
      });
      return Promise.resolve();
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    scrollToOffset(screen.getByRole('region', {name: 'transcript'}), 150);

    // Abandon the suspended render, then switch normally. The pending timeline
    // must not have received scroll events from the still-visible transcript.
    rerender(<Conversation activeTab="transcript" />);
    rerender(<Conversation activeTab="timeline" />);
    expect(screen.getByRole('region', {name: 'timeline'}).scrollTop).toBe(0);

    rerender(<Conversation activeTab="transcript" />);
    expect(screen.getByRole('region', {name: 'transcript'}).scrollTop).toBe(150);
  });
});
