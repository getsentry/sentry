import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {ConversationViewContent} from './conversationView';

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

// Two assistant turns so there is an unambiguous "first" span to default to.
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

function mockConversation() {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/ai-conversations/${CONVERSATION_ID}/`,
    body: CONVERSATION_BODY,
  });
  // The detail pane fetches full attributes per span; keep it empty.
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    body: [],
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
    // jsdom doesn't implement Element.scrollTo, which the detail pane calls.
    Element.prototype.scrollTo = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
    mockConversation();
  });

  it('opens no span by default on the transcript', async () => {
    renderView({activeTab: 'transcript'});

    expect(await screen.findByText('First answer')).toBeInTheDocument();
    expect(detailPane()).not.toBeInTheDocument();
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

  it('writes a sticky selection when the user picks a span', async () => {
    const onSelectSpan = jest.fn();
    renderView({activeTab: 'transcript', onSelectSpan});

    await userEvent.click(await screen.findByText('First answer'));

    expect(onSelectSpan).toHaveBeenCalledWith('span-a');
  });

  it('closes the timeline default and does not reopen it', async () => {
    const onDeselectSpan = jest.fn();
    renderView({activeTab: 'timeline', onDeselectSpan});

    await userEvent.click(await screen.findByRole('button', {name: 'Close'}));

    expect(onDeselectSpan).toHaveBeenCalled();
    await waitFor(() => expect(detailPane()).not.toBeInTheDocument());
  });
});
