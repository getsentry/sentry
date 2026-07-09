import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  ConversationsTable,
  InputOutputTooltipCell,
} from 'sentry/views/explore/conversations/components/conversationsTable';
import {
  useConversations,
  type Conversation,
} from 'sentry/views/explore/conversations/hooks/useConversations';

jest.mock('sentry/views/explore/conversations/hooks/useConversations');

const mockUseConversations = jest.mocked(useConversations);

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: 'conv-1',
    duration: 0,
    endTimestamp: 0,
    errors: 0,
    firstInput: 'hello',
    inputTokens: 0,
    lastOutput: 'world',
    llmCalls: 0,
    outputTokens: 0,
    startTimestamp: 0,
    toolCalls: 0,
    toolErrors: 0,
    toolNames: [],
    totalCost: null,
    totalTokens: 0,
    traceCount: 0,
    traceIds: [],
    user: null,
    ...overrides,
  };
}

function mockConversations(data: Conversation[], overrides = {}) {
  mockUseConversations.mockReturnValue({
    data,
    isFetching: false,
    error: null,
    pageLinks: undefined,
    setCursor: jest.fn(),
    ...overrides,
  } as any);
}

const MISSING_MESSAGES_TEXT = 'Capture Your Conversation Messages';

describe('ConversationsTable missing messages alert', () => {
  const organization = OrganizationFixture({features: ['gen-ai-conversations']});

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the alert when no conversation has input or output', () => {
    mockConversations([
      makeConversation({firstInput: null, lastOutput: null}),
      makeConversation({conversationId: 'conv-2', firstInput: null, lastOutput: null}),
    ]);

    render(<ConversationsTable />, {organization});

    expect(screen.getByText(MISSING_MESSAGES_TEXT)).toBeInTheDocument();
  });

  it('does not show the alert when a conversation has input or output', () => {
    mockConversations([
      makeConversation({firstInput: null, lastOutput: null}),
      makeConversation({conversationId: 'conv-2', firstInput: 'hi', lastOutput: null}),
    ]);

    render(<ConversationsTable />, {organization});

    expect(screen.queryByText(MISSING_MESSAGES_TEXT)).not.toBeInTheDocument();
  });

  it('does not show the alert when there are no conversations', () => {
    mockConversations([]);

    render(<ConversationsTable />, {organization});

    expect(screen.queryByText(MISSING_MESSAGES_TEXT)).not.toBeInTheDocument();
  });

  it('does not show the alert while fetching', () => {
    mockConversations([makeConversation({firstInput: null, lastOutput: null})], {
      isFetching: true,
    });

    render(<ConversationsTable />, {organization});

    expect(screen.queryByText(MISSING_MESSAGES_TEXT)).not.toBeInTheDocument();
  });
});

function mockOverflow(width: number, containerWidth: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: containerWidth,
  });
}

describe('InputOutputTooltipCell', () => {
  afterEach(() => {
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.scrollWidth;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.clientWidth;
  });

  it('does not show the tooltip when the cell content fits', async () => {
    mockOverflow(80, 120);

    render(
      <InputOutputTooltipCell text={'Conversation preview\n\n```js\ntooltip only\n```'} />
    );

    await userEvent.hover(screen.getByText('Conversation preview'));

    expect(screen.queryByText('tooltip only')).not.toBeInTheDocument();
  });

  it('shows the tooltip when the cell content overflows', async () => {
    mockOverflow(180, 100);

    render(
      <InputOutputTooltipCell text={'Conversation preview\n\n```js\ntooltip only\n```'} />
    );

    await userEvent.hover(screen.getByText('Conversation preview'));

    await waitFor(() => {
      expect(screen.getByText('tooltip only')).toBeInTheDocument();
    });
  });
});
