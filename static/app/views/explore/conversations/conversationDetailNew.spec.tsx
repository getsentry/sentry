import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {TopBar} from 'sentry/views/navigation/topBar';

import {ConversationDetailPageNew} from './conversationDetailNew';

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

function mockApis() {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/ai-conversations/${CONVERSATION_ID}/`,
    body: CONVERSATION_BODY,
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

function renderPage() {
  return render(
    <TopBar.Slot.Provider>
      <ConversationDetailPageNew />
    </TopBar.Slot.Provider>,
    {
      organization: OrganizationFixture(),
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

describe('ConversationDetailPageNew span default selection', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
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
});
