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
import {TopBar} from 'sentry/views/navigation/topBar';

import ConversationDetailPage from './conversationDetail';

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

function mockApis(title: string | null = null) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/ai-conversations/${CONVERSATION_ID}/`,
    body: {conversationId: CONVERSATION_ID, title, spans: CONVERSATION_BODY},
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
        route: '/organizations/:orgId/explore/conversations/:conversationId/',
        location: {
          pathname: `/organizations/org-slug/explore/conversations/${CONVERSATION_ID}/`,
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

  it('renders the parent link, conversation id heading, and copy action with the migration flag on', async () => {
    renderPage(['ui-migration-breadcrumbs']);

    const topBar = screen.getByRole('banner');

    expect(
      await within(topBar).findByRole('link', {name: 'Conversations'})
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
    mockApis(null);
    renderPage();

    // Once loaded, the summary heading shows the id (no title available).
    expect(
      await screen.findByRole('heading', {name: new RegExp(CONVERSATION_ID)})
    ).toBeInTheDocument();
  });
});
