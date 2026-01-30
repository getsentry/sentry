import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SpanFields} from 'sentry/views/insights/types';

import {MessagesPanel} from './messagesPanel';

function createMockNode(overrides: {
  id: string;
  attributes?: Record<string, string | number>;
  startTimestamp?: number;
}) {
  const {id, attributes = {}, startTimestamp = 1000} = overrides;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.generate',
    startTimestamp,
    value: {
      start_timestamp: startTimestamp,
    },
    attributes: {
      // Must be 'ai_client' for getIsAiGenerationSpan to return true
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
      ...attributes,
    },
  };
}

describe('MessagesPanel', () => {
  const mockOnSelectNode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty message when no nodes provided', () => {
    render(
      <MessagesPanel nodes={[]} selectedNodeId={null} onSelectNode={mockOnSelectNode} />
    );

    expect(screen.getByText('No messages found')).toBeInTheDocument();
  });

  it('renders user and assistant messages from gen_ai.request.messages', () => {
    const requestMessages = JSON.stringify([
      {role: 'user', content: 'Hello from request messages'},
    ]);

    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Assistant response text',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Hello from request messages')).toBeInTheDocument();
    expect(screen.getByText('Assistant response text')).toBeInTheDocument();
  });

  it('prefers gen_ai.output.messages over gen_ai.response.text for assistant', () => {
    const requestMessages = JSON.stringify([{role: 'user', content: 'User message'}]);
    const outputMessages = JSON.stringify([
      {role: 'assistant', content: 'Hello from OUTPUT messages'},
    ]);

    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_OUTPUT_MESSAGES]: outputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Fallback response text',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Hello from OUTPUT messages')).toBeInTheDocument();
    expect(screen.queryByText('Fallback response text')).not.toBeInTheDocument();
  });

  it('prefers gen_ai.input.messages over gen_ai.request.messages', () => {
    const inputMessages = JSON.stringify([
      {role: 'user', content: 'Hello from INPUT messages'},
    ]);
    const requestMessages = JSON.stringify([
      {role: 'user', content: 'Hello from REQUEST messages'},
    ]);

    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Hello from INPUT messages')).toBeInTheDocument();
    expect(screen.queryByText('Hello from REQUEST messages')).not.toBeInTheDocument();
  });

  it('falls back to gen_ai.request.messages when gen_ai.input.messages is empty string', () => {
    const requestMessages = JSON.stringify([
      {role: 'user', content: 'Hello from REQUEST messages fallback'},
    ]);

    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_INPUT_MESSAGES]: '',
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Hello from REQUEST messages fallback')).toBeInTheDocument();
  });

  it('handles messages with parts format', () => {
    const inputMessages = JSON.stringify([
      {
        role: 'user',
        parts: [{type: 'text', content: 'Message from parts format'}],
      },
    ]);

    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Message from parts format')).toBeInTheDocument();
  });

  it('handles messages with array content format', () => {
    const inputMessages = JSON.stringify([
      {
        role: 'user',
        content: [{text: 'Message from array content'}],
      },
    ]);

    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Message from array content')).toBeInTheDocument();
  });

  it('calls onSelectNode when assistant message is clicked', async () => {
    const requestMessages = JSON.stringify([{role: 'user', content: 'User message'}]);

    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Click me assistant',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // Find the assistant text and click its parent container
    const assistantText = screen.getByText('Click me assistant');
    // The clickable area is the MessageBubble which contains the text
    // We can click on the text itself - the event will bubble up
    await userEvent.click(assistantText);

    expect(mockOnSelectNode).toHaveBeenCalledWith(node);
  });

  it('displays user email when available', () => {
    const requestMessages = JSON.stringify([{role: 'user', content: 'User message'}]);

    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response',
        [SpanFields.USER_EMAIL]: 'test@example.com',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('deduplicates identical user messages', () => {
    const sameMessage = JSON.stringify([{role: 'user', content: 'Duplicate message'}]);

    const node1 = createMockNode({
      id: 'span-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: sameMessage,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response 1',
      },
    });

    const node2 = createMockNode({
      id: 'span-2',
      startTimestamp: 2000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: sameMessage,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response 2',
      },
    });

    render(
      <MessagesPanel
        nodes={[node1, node2] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // Should only show one instance of the duplicate user message
    expect(screen.getAllByText('Duplicate message')).toHaveLength(1);
    // But both assistant responses should be shown
    expect(screen.getByText('Response 1')).toBeInTheDocument();
    expect(screen.getByText('Response 2')).toBeInTheDocument();
  });
});
