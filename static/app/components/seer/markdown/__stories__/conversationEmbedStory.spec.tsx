import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Conversation} from 'sentry/views/explore/conversations/hooks/useConversations';

import {ConversationEmbedStory} from './conversationEmbedStory';

jest.mock('sentry/components/seer/markdown', () => ({
  SeerMarkdown: ({raw}: {raw: string}) => <div aria-label="Rendered markdown">{raw}</div>,
}));

function createConversation(conversation: Partial<Conversation>): Conversation {
  return {
    conversationId: 'conv-1',
    duration: 1000,
    endTimestamp: Date.UTC(2026, 7, 25, 16, 39, 2),
    errors: 0,
    firstInput: 'Where is my refund?',
    generationDuration: 800,
    inputTokens: 100,
    lastOutput: 'Escalating to a human.',
    llmCalls: 3,
    outputTokens: 50,
    projectId: 11,
    startTimestamp: Date.UTC(2026, 7, 25, 16, 37, 12),
    title: null,
    toolCalls: 1,
    toolErrors: 0,
    toolNames: ['lookup_order'],
    totalCost: 0.02,
    totalTokens: 150,
    traceCount: 1,
    traceIds: ['11111111111111111111111111111111'],
    user: null,
    ...conversation,
  };
}

describe('ConversationEmbedStory', () => {
  it('prefers a titled conversation and passes its ISO time bounds', async () => {
    const untitled = createConversation({conversationId: 'untitled-conversation'});
    const titled = createConversation({
      conversationId: 'titled-conversation',
      title: 'Refund request escalated to a human',
    });
    const conversationsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/agents/conversations/',
      body: [untitled, titled],
      match: [
        MockApiClient.matchQuery({
          project: [-1],
          per_page: 25,
          statsPeriod: '14d',
        }),
      ],
    });

    render(<ConversationEmbedStory />);

    const renderedMarkdown = await screen.findByLabelText('Rendered markdown');
    expect(renderedMarkdown).toHaveTextContent(titled.conversationId);
    expect(renderedMarkdown).toHaveTextContent('Refund request escalated to a human');
    expect(renderedMarkdown).toHaveTextContent(
      new Date(titled.startTimestamp).toISOString()
    );
    expect(renderedMarkdown).toHaveTextContent(
      new Date(titled.endTimestamp).toISOString()
    );
    expect(renderedMarkdown).not.toHaveTextContent(untitled.conversationId);
    expect(conversationsRequest).toHaveBeenCalled();
  });

  it('falls back to the most recent conversation when none has a title', async () => {
    const older = createConversation({
      conversationId: 'older-conversation',
      endTimestamp: Date.UTC(2026, 7, 24, 10, 0, 0),
    });
    const newer = createConversation({
      conversationId: 'newer-conversation',
      endTimestamp: Date.UTC(2026, 7, 26, 10, 0, 0),
    });
    // The endpoint orders by relevance, so the newest row is not necessarily first.
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/agents/conversations/',
      body: [older, newer],
    });

    render(<ConversationEmbedStory />);

    const renderedMarkdown = await screen.findByLabelText('Rendered markdown');
    expect(renderedMarkdown).toHaveTextContent(newer.conversationId);
    expect(renderedMarkdown).not.toHaveTextContent(older.conversationId);
  });

  it('renders a message when the organization has no conversations', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/agents/conversations/',
      body: [],
    });

    render(<ConversationEmbedStory />);

    expect(
      await screen.findByText('No conversation is available for this organization.')
    ).toBeInTheDocument();
  });
});
