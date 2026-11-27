import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {trackAnalytics} from 'sentry/utils/analytics';

import {ConversationViewContent} from './conversationView';

jest.mock('sentry/utils/analytics');

const CONVERSATION_ID = 'conv-1';
const originalIntersectionObserver = window.IntersectionObserver;
let triggerIntersection: ((isIntersecting: boolean) => void) | undefined;

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    triggerIntersection = isIntersecting =>
      callback(
        [{isIntersecting} as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
  }

  observe() {}
  disconnect() {}
}

function spanFixture(overrides: Record<string, unknown>) {
  return {
    'gen_ai.conversation.id': CONVERSATION_ID,
    parent_span: 'parent-1',
    project: 'test-project',
    'project.id': 1,
    'span.status': 'ok',
    trace: 'trace-1',
    'gen_ai.operation.type': 'ai_client',
    ...overrides,
  };
}

// Two assistant turns so there is an unambiguous "first" span to default to.
const CONVERSATION_BODY = [
  spanFixture({
    span_id: 'span-a',
    'span.name': 'first turn',
    'precise.start_ts': 1000,
    'precise.finish_ts': 1000.5,
    'gen_ai.input.messages': JSON.stringify([{role: 'user', content: 'First?'}]),
    'gen_ai.output.messages': JSON.stringify([
      {role: 'assistant', content: 'First answer'},
    ]),
  }),
  spanFixture({
    span_id: 'span-b',
    'span.name': 'second turn',
    'precise.start_ts': 2000,
    'precise.finish_ts': 2000.5,
    'gen_ai.input.messages': JSON.stringify([{role: 'user', content: 'Second?'}]),
    'gen_ai.output.messages': JSON.stringify([
      {role: 'assistant', content: 'Second answer'},
    ]),
  }),
];

function mockConversation(
  spans = CONVERSATION_BODY,
  {
    asyncDelay,
    cursor,
    nextCursor,
  }: {asyncDelay?: number; cursor?: string; nextCursor?: string} = {}
) {
  const url = `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`;
  const request = MockApiClient.addMockResponse({
    url,
    match: [MockApiClient.matchQuery({cursor})],
    asyncDelay,
    body: {conversationId: CONVERSATION_ID, title: null, spans},
    headers: nextCursor
      ? {
          Link: `<${url}?cursor=${nextCursor}>; rel="next"; results="true"; cursor="${nextCursor}"`,
        }
      : undefined,
  });
  // The detail pane fetches full attributes per span; keep it empty.
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    body: [],
  });
  MockApiClient.addMockResponse({url: '/organizations/org-slug/projects/', body: []});
  return request;
}

function renderView(
  props: Partial<React.ComponentProps<typeof ConversationViewContent>> = {}
) {
  return render(
    <ConversationViewContent
      conversation={{conversationId: CONVERSATION_ID}}
      activeTab="transcript"
      {...props}
    />,
    {organization: OrganizationFixture()}
  );
}

// The detail pane's Close button is the stable signal that a span is open.
function detailPane() {
  return screen.queryByRole('button', {name: 'Close'});
}

describe('ConversationViewContent', () => {
  beforeEach(() => {
    window.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    triggerIntersection = undefined;
    // jsdom implements neither scroll API the view relies on: the detail pane
    // calls scrollTo, and switching tabs reveals a selected span via scrollIntoView.
    Element.prototype.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
    mockConversation();
    MockApiClient.addMockResponse({url: '/organizations/org-slug/dashboards/', body: []});
  });

  afterAll(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it('opens no span by default on the transcript', async () => {
    renderView({activeTab: 'transcript'});

    expect(await screen.findByText('First answer')).toBeInTheDocument();
    expect(detailPane()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Jump to end'})).not.toBeInTheDocument();
  });

  it('requests a Code Mode summary only when its details are opened', async () => {
    mockConversation([
      CONVERSATION_BODY[0]!,
      spanFixture({
        span_id: 'tool-span',
        parent_span: 'span-a',
        'span.name': 'execute_code',
        'precise.start_ts': 1000.1,
        'precise.finish_ts': 1000.2,
        'gen_ai.operation.type': 'tool',
        'gen_ai.tool.name': 'execute_code',
        'gen_ai.tool.call.arguments': JSON.stringify({
          code: 'print(42)',
          language: 'python',
        }),
      }),
    ]);
    const request = MockApiClient.addMockResponse({
      url: '/projects/org-slug/1/ai/code-explanation/',
      method: 'POST',
      body: {summary: 'Print a number'},
    });

    const {rerender} = render(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="transcript"
      />
    );

    expect(
      await screen.findByRole('button', {name: 'Select tool call execute_code'})
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', {name: 'Summary'})).not.toBeInTheDocument();

    rerender(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="transcript"
        selectedSpanId="tool-span"
      />
    );
    expect(await screen.findByText('Print a number')).toBeInTheDocument();
  });

  it('loads the next page when the pagination footer is visible', async () => {
    MockApiClient.clearMockResponses();
    mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'next'});
    const nextRequest = mockConversation([CONVERSATION_BODY[1]!], {
      cursor: 'next',
      nextCursor: 'last',
    });

    renderView({activeTab: 'timeline'});
    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();
    expect(nextRequest).not.toHaveBeenCalled();

    const scrollContainer = document.querySelector<HTMLElement>('[data-scrollable]')!;
    expect(
      scrollContainer.querySelector('[data-test-id="loading-indicator"]')
    ).toBeInTheDocument();
    act(() => triggerIntersection?.(true));

    await waitFor(() => expect(nextRequest).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('second turn')).toBeInTheDocument();
    expect(
      scrollContainer.querySelector('[data-test-id="loading-indicator"]')
    ).toBeInTheDocument();
  });

  it.each([
    {
      name: 'scrolling',
      failedRequests: 1,
      load: () => Promise.resolve(act(() => triggerIntersection?.(true))),
    },
    {
      name: 'jumping to the end',
      failedRequests: 2,
      load: async () => {
        await userEvent.click(screen.getByRole('button', {name: 'Jump to end'}));
        await waitFor(() => expect(Element.prototype.scrollTo).toHaveBeenCalled());
      },
    },
  ])(
    'keeps loaded spans and offers retry when $name fails',
    async ({failedRequests, load}) => {
      MockApiClient.clearMockResponses();
      mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'next'});
      const nextRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
        match: [MockApiClient.matchQuery({cursor: 'next'})],
        statusCode: 500,
      });

      renderView();
      expect(await screen.findByText('First answer')).toBeInTheDocument();

      await load();

      const retry = await screen.findByRole('button', {name: 'Retry'});
      expect(screen.getByText('First answer')).toBeInTheDocument();
      await waitFor(() => expect(nextRequest).toHaveBeenCalledTimes(failedRequests));

      await userEvent.click(retry);
      await waitFor(() => expect(nextRequest).toHaveBeenCalledTimes(failedRequests + 1));
    }
  );

  it('opens the first span by default on the timeline', async () => {
    renderView({activeTab: 'timeline'});

    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();
  });

  it('does not write the timeline default into the URL selection', async () => {
    const onSelectSpan = jest.fn();
    renderView({activeTab: 'timeline', onSelectSpan});

    // Wait until the default detail pane has opened.
    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();
    // The default is view-local, so the sticky (URL) selection stays untouched;
    // this is what keeps it from leaking back into the transcript.
    expect(onSelectSpan).not.toHaveBeenCalled();
  });

  it('opens a deep-linked span on the transcript', async () => {
    renderView({activeTab: 'transcript', selectedSpanId: 'span-a'});

    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();
  });

  it('loads later pages to resolve a deep-linked span', async () => {
    MockApiClient.clearMockResponses();
    mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'next'});
    const nextRequest = mockConversation([CONVERSATION_BODY[1]!], {cursor: 'next'});

    renderView({activeTab: 'transcript', selectedSpanId: 'span-b'});

    expect(await screen.findByText('ID: span-b')).toBeInTheDocument();
    expect(nextRequest).toHaveBeenCalledTimes(1);
  });

  it('searches the transcript and selects the span with the match', async () => {
    const onSelectSpan = jest.fn();
    renderView({onSelectSpan});
    await screen.findByText('Second answer');

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search in transcript'}),
      'second answer{Enter}'
    );

    expect(await screen.findByText('1/1')).toBeInTheDocument();
    expect(onSelectSpan).toHaveBeenCalledWith('span-b');

    await userEvent.clear(screen.getByRole('textbox', {name: 'Search in transcript'}));
    expect(screen.queryByText('1/1')).not.toBeInTheDocument();
  });

  it('searches the system prompt and selects the span it came from', async () => {
    mockConversation([
      spanFixture({
        ...CONVERSATION_BODY[0],
        'gen_ai.input.messages': JSON.stringify([
          {role: 'system', content: 'You sort emails into labels.'},
          {role: 'user', content: 'First?'},
        ]),
      }),
      CONVERSATION_BODY[1]!,
    ]);
    const onSelectSpan = jest.fn();
    renderView({onSelectSpan});
    await screen.findByText('First answer');

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search in transcript'}),
      'sort emails{Enter}'
    );

    expect(await screen.findByText('1/1')).toBeInTheDocument();
    expect(onSelectSpan).toHaveBeenCalledWith('span-a');
  });

  it('loads later pages until the search finds a match', async () => {
    MockApiClient.clearMockResponses();
    mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'next'});
    const nextRequest = mockConversation([CONVERSATION_BODY[1]!], {cursor: 'next'});
    const onSelectSpan = jest.fn();
    renderView({onSelectSpan});
    await screen.findByText('First answer');

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search in transcript'}),
      'second answer{Enter}'
    );

    expect(await screen.findByText('1/1')).toBeInTheDocument();
    expect(nextRequest).toHaveBeenCalledTimes(1);
    expect(onSelectSpan).toHaveBeenCalledWith('span-b');
  });

  it('shows no results once every page is searched', async () => {
    MockApiClient.clearMockResponses();
    mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'next'});
    const nextRequest = mockConversation([CONVERSATION_BODY[1]!], {cursor: 'next'});
    const onSelectSpan = jest.fn();
    renderView({onSelectSpan});
    await screen.findByText('First answer');

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search in transcript'}),
      'not in this conversation{Enter}'
    );

    expect(await screen.findByText('No results')).toBeInTheDocument();
    expect(nextRequest).toHaveBeenCalledTimes(1);
    expect(onSelectSpan).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalledWith(
      'conversations.detail.span-limit-reached',
      expect.anything()
    );
  });

  describe('jump to end', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('adds the remaining pages in one update and scrolls, across a tab switch', async () => {
      jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(5000);
      MockApiClient.clearMockResponses();
      mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'page-2'});
      mockConversation([CONVERSATION_BODY[1]!], {cursor: 'page-2', nextCursor: 'page-3'});
      const lastPage = mockConversation([], {cursor: 'page-3', asyncDelay: 50});
      const {rerender} = renderView();
      await screen.findByText('First answer');

      await userEvent.click(screen.getByRole('button', {name: 'Jump to end'}));

      await waitFor(() => expect(lastPage).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Second answer')).not.toBeInTheDocument();
      rerender(
        <ConversationViewContent
          conversation={{conversationId: CONVERSATION_ID}}
          activeTab="timeline"
        />
      );
      expect(await screen.findByText('second turn')).toBeInTheDocument();
      await waitFor(() =>
        expect(Element.prototype.scrollTo).toHaveBeenCalledWith({top: 5000})
      );
      expect(trackAnalytics).toHaveBeenCalledWith(
        'conversations.detail.jump-to-end',
        expect.anything()
      );
    });

    it('retries a failed page before scrolling to the end', async () => {
      const scrolledToSecondAnswer = jest.fn();
      jest
        .mocked(Element.prototype.scrollTo)
        .mockImplementation(() =>
          scrolledToSecondAnswer(screen.queryByText('Second answer') !== null)
        );
      MockApiClient.clearMockResponses();
      mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'page-2'});
      mockConversation([CONVERSATION_BODY[1]!], {cursor: 'page-2', asyncDelay: 50});
      let failures = 0;
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
        match: [MockApiClient.matchQuery({cursor: 'page-2'}), () => failures++ === 0],
        statusCode: 500,
      });
      renderView();
      await screen.findByText('First answer');

      await userEvent.click(screen.getByRole('button', {name: 'Jump to end'}));

      await waitFor(() => expect(scrolledToSecondAnswer).toHaveBeenCalled());
      expect(scrolledToSecondAnswer.mock.calls).toEqual([[true]]);
      expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument();
    });

    it('stops loading pages when the user stops the jump', async () => {
      MockApiClient.clearMockResponses();
      mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'page-2'});
      const secondPage = mockConversation([CONVERSATION_BODY[1]!], {
        cursor: 'page-2',
        nextCursor: 'page-3',
        asyncDelay: 200,
      });
      const thirdPage = mockConversation([], {cursor: 'page-3'});
      renderView();
      await screen.findByText('First answer');

      await userEvent.click(screen.getByRole('button', {name: 'Jump to end'}));
      await userEvent.click(await screen.findByRole('button', {name: 'Stop loading'}));

      expect(
        await screen.findByRole('button', {name: 'Jump to end'})
      ).toBeInTheDocument();
      expect(secondPage).toHaveBeenCalledTimes(1);
      expect(thirdPage).not.toHaveBeenCalled();
      expect(screen.queryByText('Second answer')).not.toBeInTheDocument();
    });
  });

  describe('at the span limit', () => {
    afterEach(() => {
      try {
        cleanup();
        jest.runOnlyPendingTimers();
      } finally {
        jest.useRealTimers();
      }
    });

    it('reports when the span limit stops a search', async () => {
      MockApiClient.clearMockResponses();
      mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'next'});
      let page = 1;
      const nextRequest = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
        match: [MockApiClient.matchQuery({cursor: 'next'})],
        body: () => {
          page++;
          return {
            conversationId: CONVERSATION_ID,
            title: null,
            spans: [{...CONVERSATION_BODY[1]!, span_id: `span-${page}`}],
          };
        },
        headers: {
          Link: `</organizations/org-slug/agents/conversations/${CONVERSATION_ID}/?cursor=next>; rel="next"; results="true"; cursor="next"`,
        },
      });
      jest.useFakeTimers();
      renderView({onSelectSpan: jest.fn()});
      await screen.findByText('First answer');

      await userEvent.type(
        screen.getByRole('textbox', {name: 'Search in transcript'}),
        'not in this conversation{Enter}',
        {delay: null}
      );
      await act(() => jest.runAllTimersAsync());

      expect(screen.getByText('No results')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      expect(nextRequest).toHaveBeenCalledTimes(99);
      expect(trackAnalytics).toHaveBeenCalledTimes(1);
      expect(trackAnalytics).toHaveBeenCalledWith(
        'conversations.detail.span-limit-reached',
        expect.objectContaining({organization: expect.anything()})
      );
    });
  });

  it('does not show the timeline default while a deep link is unresolved', async () => {
    MockApiClient.clearMockResponses();
    mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'next'});
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
      match: [MockApiClient.matchQuery({cursor: 'next'})],
      statusCode: 500,
    });

    renderView({activeTab: 'timeline', selectedSpanId: 'span-b'});

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(screen.queryByText('ID: span-a')).not.toBeInTheDocument();
    expect(detailPane()).not.toBeInTheDocument();
  });

  it('shows the span ID of the open span', async () => {
    renderView({activeTab: 'transcript', selectedSpanId: 'span-a'});

    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();

    expect(screen.getByText('ID: span-a')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy to clipboard'})).toBeInTheDocument();
  });

  it('writes a sticky selection when the user picks a span', async () => {
    const onSelectSpan = jest.fn();
    renderView({activeTab: 'transcript', onSelectSpan});

    await userEvent.click(await screen.findByText('First answer'));

    expect(onSelectSpan).toHaveBeenCalledWith('span-a');
  });

  it('scrolls the selected span into view when switching tabs', async () => {
    const {rerender} = renderView({activeTab: 'transcript', selectedSpanId: 'span-a'});

    // Wait for the deep-linked selection to render before asserting the switch.
    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();

    jest.mocked(Element.prototype.scrollIntoView).mockClear();

    rerender(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="timeline"
        selectedSpanId="span-a"
      />
    );

    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({block: 'nearest'})
    );
  });

  it('does not snap to the timeline default when no span is selected', async () => {
    // The timeline opens on a default span, but that view-local default is not a
    // real selection: entering the timeline must restore its saved offset rather
    // than scroll the default span into view.
    const {rerender} = renderView({activeTab: 'transcript'});
    expect(await screen.findByText('First answer')).toBeInTheDocument();

    jest.mocked(Element.prototype.scrollIntoView).mockClear();

    rerender(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="timeline"
      />
    );

    // The default span still opens the detail pane...
    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();
    // ...but nothing is scrolled into view, so the saved offset is restored.
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('does not scroll into view when returning to a tab with no selection', async () => {
    const {rerender} = renderView({activeTab: 'transcript'});
    expect(await screen.findByText('First answer')).toBeInTheDocument();

    // Neither switch has a sticky selection, so both restore the saved offset
    // rather than scroll a row into view.
    rerender(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="timeline"
      />
    );
    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();

    jest.mocked(Element.prototype.scrollIntoView).mockClear();

    rerender(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="transcript"
      />
    );

    expect(await screen.findByText('First answer')).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('closes the timeline default and does not reopen it', async () => {
    const onDeselectSpan = jest.fn();
    renderView({activeTab: 'timeline', onDeselectSpan});

    await userEvent.click(await screen.findByRole('button', {name: 'Close'}));

    expect(onDeselectSpan).toHaveBeenCalled();
    await waitFor(() => expect(detailPane()).not.toBeInTheDocument());
  });
});
