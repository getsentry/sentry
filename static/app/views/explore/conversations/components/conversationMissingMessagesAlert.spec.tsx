import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ConversationMissingMessagesAlert} from 'sentry/views/explore/conversations/components/conversationMissingMessagesAlert';

const organization = OrganizationFixture({
  features: ['gen-ai-conversations'],
});

const BASE_CONVERSATION = {
  conversationId: 'conv-1',
  endTimestamp: 2000,
  errors: 0,
  firstInput: null,
  generationDuration: 5000,
  lastOutput: null,
  inputTokens: 10,
  outputTokens: 20,
  llmCalls: 3,
  projectId: null,
  startTimestamp: 1000,
  title: null,
  toolCalls: 0,
  toolErrors: 0,
  toolNames: [],
  totalCost: null,
  totalTokens: 100,
  traceCount: 1,
  traceIds: ['trace-1'],
  user: null,
};

describe('ConversationMissingMessagesAlert', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

  it('renders when every conversation is missing input and output', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [BASE_CONVERSATION],
    });

    render(<ConversationMissingMessagesAlert />, {organization});

    expect(
      await screen.findByText('Capture Your Conversation Messages')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).toBeInTheDocument();
  });

  it('does not render when a conversation has message content', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: 'hello'}],
    });

    render(<ConversationMissingMessagesAlert />, {organization});

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(
      screen.queryByText('Capture Your Conversation Messages')
    ).not.toBeInTheDocument();
  });
});
