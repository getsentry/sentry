import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {ConversationViewContent} from './conversationView';

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
  {cursor, nextCursor}: {cursor?: string; nextCursor?: string} = {}
) {
  const url = `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`;
  const request = MockApiClient.addMockResponse({
    url,
    match: [MockApiClient.matchQuery({cursor})],
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
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    body: [],
  });
  return request;
}

function mockTranscriptPage(content: string, cursor?: string, nextCursor?: string) {
  const url = `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`;
  return MockApiClient.addMockResponse({
    url,
    match: [MockApiClient.matchQuery({view: 'transcript', cursor})],
    headers: nextCursor
      ? {
          Link: `<${url}?cursor=${nextCursor}>; rel="next"; results="true"; cursor="${nextCursor}"`,
        }
      : undefined,
    body: {
      conversationId: CONVERSATION_ID,
      title: null,
      complete: nextCursor === undefined,
      sourceSpanCount: 1,
      transcript: [
        {id: content, role: 'assistant', content, timestamp: 1000, nodeId: 'span-a'},
      ],
    },
  });
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
  });

  afterAll(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  it('renders backend messages in the existing panel when the feature is enabled', async () => {
    const backend = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
      match: [MockApiClient.matchQuery({view: 'transcript'})],
      body: {
        conversationId: CONVERSATION_ID,
        title: null,
        complete: true,
        sourceSpanCount: 2,
        transcript: [
          {
            id: 'assistant-span-a',
            role: 'assistant',
            content: 'Backend answer',
            timestamp: 1000.5,
            nodeId: 'span-a',
          },
        ],
      },
    });
    render(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="transcript"
      />,
      {
        organization: OrganizationFixture({
          features: ['gen-ai-conversations-backend-transcript'],
        }),
      }
    );
    expect(await screen.findByText('Backend answer')).toBeInTheDocument();
    expect(screen.queryByText('First answer')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', {name: 'Transcript source'})
    ).not.toBeInTheDocument();
    expect(backend).toHaveBeenCalledTimes(1);
    expect(detailPane()).not.toBeInTheDocument();
  });

  it('loads and combines backend message pages using transcript cursors', async () => {
    const first = mockTranscriptPage('Backend page one', undefined, 't2');
    const second = mockTranscriptPage('Backend page two', 't2', 't3');
    const third = mockTranscriptPage('Backend page three', 't3', 't4');
    const fourth = mockTranscriptPage('Backend page four', 't4');
    render(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID, projects: [1]}}
        activeTab="transcript"
      />,
      {
        organization: OrganizationFixture({
          features: ['gen-ai-conversations-backend-transcript'],
        }),
      }
    );
    expect(await screen.findByText('Backend page four')).toBeInTheDocument();
    expect(screen.getByText('Backend page one')).toBeInTheDocument();
    expect(screen.getByText('Backend page two')).toBeInTheDocument();
    expect(screen.getByText('Backend page three')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load conversation')).not.toBeInTheDocument();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(third).toHaveBeenCalledTimes(1);
    expect(fourth).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({view: 'transcript', cursor: 't2', project: [1]}),
      })
    );
  });

  it('shows an error when a later backend page fails', async () => {
    mockTranscriptPage('Backend page one', undefined, 't2');
    const next = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
      match: [MockApiClient.matchQuery({view: 'transcript', cursor: 't2'})],
      statusCode: 503,
      body: {detail: 'Unable to read transcript context'},
    });
    render(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="transcript"
      />,
      {
        organization: OrganizationFixture({
          features: ['gen-ai-conversations-backend-transcript'],
        }),
      }
    );
    expect(await screen.findByText('Failed to load conversation')).toBeInTheDocument();
    expect(next).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('First answer')).not.toBeInTheDocument();
  });

  it('rejects a repeated transcript cursor instead of fetching forever', async () => {
    const first = mockTranscriptPage('Backend page one', undefined, 't2');
    const next = mockTranscriptPage('Backend page two', 't2', 't2');
    render(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="transcript"
      />,
      {
        organization: OrganizationFixture({
          features: ['gen-ai-conversations-backend-transcript'],
        }),
      }
    );
    expect(await screen.findByText('Failed to load conversation')).toBeInTheDocument();
    expect(first).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not request a backend transcript without the feature', async () => {
    const backend = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
      match: [MockApiClient.matchQuery({view: 'transcript'})],
      body: {complete: true, transcript: []},
    });
    renderView();
    expect(await screen.findByText('First answer')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Backend transcript'})
    ).not.toBeInTheDocument();
    expect(backend).not.toHaveBeenCalled();
  });

  it.each([
    {statusCode: 503, body: {detail: 'Unable to read transcript parent context'}},
    {statusCode: 200, body: {complete: false, transcript: []}},
  ])(
    'shows conversation errors without falling back to frontend messages ($statusCode)',
    async ({statusCode, body}) => {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
        match: [MockApiClient.matchQuery({view: 'transcript'})],
        statusCode,
        body,
      });
      render(
        <ConversationViewContent
          conversation={{conversationId: CONVERSATION_ID}}
          activeTab="transcript"
        />,
        {
          organization: OrganizationFixture({
            features: ['gen-ai-conversations-backend-transcript'],
          }),
        }
      );
      expect(await screen.findByText('Failed to load conversation')).toBeInTheDocument();
      expect(screen.queryByText('First answer')).not.toBeInTheDocument();
    }
  );

  it('does not fetch a backend transcript on the timeline tab', async () => {
    const backend = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
      match: [MockApiClient.matchQuery({view: 'transcript'})],
      body: {complete: true, transcript: []},
    });
    render(
      <ConversationViewContent
        conversation={{conversationId: CONVERSATION_ID}}
        activeTab="timeline"
      />,
      {
        organization: OrganizationFixture({
          features: ['gen-ai-conversations-backend-transcript'],
        }),
      }
    );
    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();
    expect(backend).not.toHaveBeenCalled();
  });

  it('opens no span by default on the transcript', async () => {
    renderView({activeTab: 'transcript'});

    expect(await screen.findByText('First answer')).toBeInTheDocument();
    expect(detailPane()).not.toBeInTheDocument();
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

  it('keeps loaded spans visible and offers retry when pagination fails', async () => {
    MockApiClient.clearMockResponses();
    mockConversation([CONVERSATION_BODY[0]!], {nextCursor: 'next'});
    const nextRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
      match: [MockApiClient.matchQuery({cursor: 'next'})],
      statusCode: 500,
    });

    renderView();
    expect(await screen.findByText('First answer')).toBeInTheDocument();

    act(() => triggerIntersection?.(true));

    const retry = await screen.findByRole('button', {name: 'Retry'});
    expect(screen.getByText('First answer')).toBeInTheDocument();
    expect(nextRequest).toHaveBeenCalledTimes(1);

    await userEvent.click(retry);
    await waitFor(() => expect(nextRequest).toHaveBeenCalledTimes(2));
  });

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
    const {rerender} = renderView({
      activeTab: 'transcript',
      selectedSpanId: 'span-a',
    });

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
