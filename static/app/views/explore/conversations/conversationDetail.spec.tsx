import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import type {ConversationAggregates} from 'sentry/views/explore/conversations/hooks/useConversation';
import {TopBar} from 'sentry/views/navigation/topBar';

import ConversationDetailPage from './conversationDetail';
import {CONVERSATIONS_SIDEBAR_LABEL} from './settings';

const CONVERSATION_ID = 'conv-1';

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

const CONVERSATION_BODY = [
  spanFixture({
    span_id: 'span-a',
    'span.name': 'first turn',
    'precise.start_ts': 1000,
    'precise.finish_ts': 1000.5,
    'gen_ai.request.messages': JSON.stringify([{role: 'user', content: 'First?'}]),
    'gen_ai.response.text': 'First answer',
  }),
  spanFixture({
    span_id: 'span-b',
    'span.name': 'second turn',
    'precise.start_ts': 2000,
    'precise.finish_ts': 2000.5,
    'gen_ai.request.messages': JSON.stringify([{role: 'user', content: 'Second?'}]),
    'gen_ai.response.text': 'Second answer',
  }),
];

const DEFAULT_AGGREGATES: ConversationAggregates = {
  endTimestamp: 2_000_000,
  generationDuration: 1000,
  inputTokens: 0,
  llmCalls: 2,
  modelUsage: [],
  outputTokens: 0,
  startTimestamp: 1_000_000,
  toolCalls: 0,
  toolErrors: 0,
  toolNames: [],
  totalCost: 0,
  totalTokens: 0,
};

function mockApis(
  title: string | null = null,
  spans: Array<Record<string, unknown>> = CONVERSATION_BODY,
  aggregateOverrides: Partial<ConversationAggregates> = {}
) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`,
    body: {
      conversationId: CONVERSATION_ID,
      title,
      spans,
      ...DEFAULT_AGGREGATES,
      ...aggregateOverrides,
    },
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
    body: [],
  });
}

function renderPage(features: string[] = []) {
  return render(
    <TopBar.Slot.Provider>
      <TopBar />
      <ConversationDetailPage />
    </TopBar.Slot.Provider>,
    {
      organization: OrganizationFixture({features}),
      initialRouterConfig: {
        route: '/organizations/:orgId/explore/agents/conversations/:conversationId/',
        location: {
          pathname: `/organizations/org-slug/explore/agents/conversations/${CONVERSATION_ID}/`,
        },
      },
    }
  );
}

function detailPane() {
  return screen.queryByRole('button', {name: 'Close'});
}

describe('ConversationDetailPage span default selection', () => {
  beforeEach(() => {
    // jsdom implements neither scroll API the view relies on.
    Element.prototype.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
    mockApis();
  });

  it('opens the first span when switching from transcript to timeline', async () => {
    renderPage();

    // Transcript is the default tab: nothing is open.
    expect(await screen.findByText('First answer')).toBeInTheDocument();
    expect(detailPane()).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Timeline'}));

    // Timeline should open on its first span.
    await waitFor(() => expect(detailPane()).toBeInTheDocument());
  });

  it('shows the copy transcript button only on the transcript tab', async () => {
    renderPage();

    // The transcript tab exposes the copy control once messages have loaded.
    expect(
      await screen.findByRole('button', {name: 'Copy Transcript'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Timeline'}));

    // The timeline tab has no transcript to copy.
    expect(
      screen.queryByRole('button', {name: 'Copy Transcript'})
    ).not.toBeInTheDocument();
  });
});

describe('ConversationDetailPage breadcrumbs', () => {
  beforeEach(() => {
    // jsdom implements neither scroll API the view relies on.
    Element.prototype.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
    mockApis();
  });

  it('renders the parent link, conversation id heading, and copy action', async () => {
    renderPage();

    const topBar = screen.getByRole('banner');

    expect(
      await within(topBar).findByRole('link', {
        name: CONVERSATIONS_SIDEBAR_LABEL,
      })
    ).toBeInTheDocument();
    // The conversation id is the top-bar identifier, owned by the TopBar title
    // slot, alongside the copy affordance.
    expect(
      within(topBar).getByRole('heading', {name: new RegExp(CONVERSATION_ID)})
    ).toBeInTheDocument();
    expect(
      within(topBar).getByRole('button', {name: 'Copy conversation ID'})
    ).toBeInTheDocument();
  });
});

describe('ConversationDetailPage title', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

  it('shows the conversation title as the heading when present', async () => {
    mockApis('Trip planning assistant');
    renderPage();

    expect(
      await screen.findByRole('heading', {name: 'Trip planning assistant'})
    ).toBeInTheDocument();
  });

  it('falls back to the conversation id heading when there is no title', async () => {
    mockApis();
    renderPage();

    // Once loaded, the summary heading shows the id (no title available).
    expect(
      await screen.findByRole('heading', {name: new RegExp(CONVERSATION_ID)})
    ).toBeInTheDocument();
  });
});

describe('ConversationDetailPage summary aggregates', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

  it('uses the reported total when a model breakdown is incomplete', async () => {
    mockApis(null, CONVERSATION_BODY, {
      modelUsage: [
        {
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          inputCost: 0,
          inputTokens: 100,
          isComplete: false,
          model: null,
          outputCost: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          totalCost: 0,
          totalTokens: 150,
        },
      ],
      totalTokens: 150,
    });
    renderPage();

    const tokenCount = await screen.findByText('150');
    await userEvent.hover(tokenCount.parentElement!);

    expect(await screen.findAllByText('150')).toHaveLength(2);
    expect(screen.getByText('Unknown model')).toBeInTheDocument();
  });

  it('uses the API token breakdown ordered by model usage', async () => {
    mockApis(null, CONVERSATION_BODY, {
      modelUsage: [
        {
          cacheReadTokens: 20,
          cacheWriteTokens: 10,
          inputCost: 0.02,
          inputTokens: 200,
          isComplete: true,
          model: 'model-beta',
          outputCost: 0.01,
          outputTokens: 100,
          reasoningTokens: 30,
          totalCost: 0.03,
          totalTokens: 300,
        },
        {
          cacheReadTokens: 10,
          cacheWriteTokens: 5,
          inputCost: 0.015,
          inputTokens: 180,
          isComplete: true,
          model: 'model-alpha',
          outputCost: 0.01,
          outputTokens: 70,
          reasoningTokens: 20,
          totalCost: 0.025,
          totalTokens: 250,
        },
      ],
      totalCost: 0.055,
      totalTokens: 550,
    });
    renderPage();

    const tokenCount = await screen.findByText('550');
    expect(tokenCount).not.toHaveAttribute('title');
    await userEvent.hover(tokenCount.parentElement!);

    const modelAlpha = await screen.findByText('model-alpha');
    expect(screen.getAllByText('model-alpha')).toHaveLength(1);
    const modelBeta = screen.getByText('model-beta');
    expect(modelBeta.compareDocumentPosition(modelAlpha)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('shows the API cost breakdown by model', async () => {
    mockApis(null, CONVERSATION_BODY, {
      modelUsage: [
        {
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          inputCost: 0.02,
          inputTokens: 70,
          isComplete: true,
          model: 'model-alpha',
          outputCost: 0.01,
          outputTokens: 30,
          reasoningTokens: 0,
          totalCost: 0.03,
          totalTokens: 100,
        },
      ],
      totalCost: 0.03,
    });
    renderPage();

    const cost = await screen.findByTitle('$0.03');
    await userEvent.hover(cost.parentElement!);

    expect(await screen.findByText('Input cost')).toBeInTheDocument();
    expect(screen.getByText('Output cost')).toBeInTheDocument();
    expect(screen.getByText('model-alpha')).toBeInTheDocument();
  });

  it('renders the fire icon in the summary when a span errored', async () => {
    mockApis(null, [
      ...CONVERSATION_BODY,
      spanFixture({
        span_id: 'span-error',
        'span.name': 'failed turn',
        'span.status': 'internal_error',
        'precise.start_ts': 3000,
        'precise.finish_ts': 3000.5,
      }),
    ]);
    renderPage();

    // The summary renders the fire icon once the conversation finishes loading.
    expect(await screen.findByTestId('conversation-error-icon')).toBeInTheDocument();
  });

  it('renders the earliest span start as the conversation start time', async () => {
    mockApis();
    renderPage();

    // The conversation opens with the 1000s span, not the 2000s one that follows.
    expect(await screen.findByText('Jan 1, 1970 12:16 AM UTC')).toBeInTheDocument();
  });

  it('leads the tool tags with the ones that errored', async () => {
    mockApis(
      null,
      [
        ...CONVERSATION_BODY,
        spanFixture({
          span_id: 'span-tool-ok',
          'span.name': 'alpha call',
          'gen_ai.operation.type': 'tool',
          'gen_ai.tool.name': 'alpha_tool',
          'precise.start_ts': 3000,
          'precise.finish_ts': 3000.5,
        }),
        spanFixture({
          span_id: 'span-tool-failed',
          'span.name': 'zeta call',
          'span.status': 'internal_error',
          'gen_ai.operation.type': 'tool',
          'gen_ai.tool.name': 'zeta_tool',
          'precise.start_ts': 4000,
          'precise.finish_ts': 4000.5,
        }),
      ],
      {toolNames: ['alpha_tool', 'zeta_tool']}
    );
    renderPage();

    expect(await screen.findByText('Tools:')).toBeInTheDocument();

    // Alphabetically alpha_tool would lead, but the errored zeta_tool outranks it.
    const tags = screen.getAllByText(/^(alpha|zeta)_tool$/);
    const names = tags.map(tag => tag.textContent);
    expect(names.indexOf('zeta_tool')).toBeLessThan(names.indexOf('alpha_tool'));
  });

  it('omits the fire icon in the summary when there are no errors', async () => {
    mockApis();
    renderPage();

    // Wait for the conversation to load before asserting the icon's absence.
    expect(await screen.findByText('First answer')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-error-icon')).not.toBeInTheDocument();
  });
});
