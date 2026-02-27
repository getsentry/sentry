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
    errors: new Set(),
  };
}

function createMockToolNode(overrides: {
  id: string;
  toolName: string;
  startTimestamp?: number;
}) {
  const {id, toolName, startTimestamp = 1000} = overrides;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.execute_tool',
    startTimestamp,
    value: {
      start_timestamp: startTimestamp,
    },
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'tool',
      [SpanFields.GEN_AI_TOOL_NAME]: toolName,
    },
    errors: new Set(),
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

  it('displays tool calls on assistant messages', () => {
    const requestMessages = JSON.stringify([
      {role: 'user', content: 'Check the weather'},
    ]);

    // Generation span that triggers tool calls
    const generationNode1 = createMockNode({
      id: 'span-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Let me check the weather for you',
      },
    });

    // Tool execution spans
    const toolNode1 = createMockToolNode({
      id: 'tool-1',
      toolName: 'weather',
      startTimestamp: 1500,
    });

    // Generation span with results
    const generationNode2 = createMockNode({
      id: 'span-2',
      startTimestamp: 2000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'The weather is sunny',
      },
    });

    render(
      <MessagesPanel
        nodes={[generationNode1, toolNode1, generationNode2] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('The weather is sunny')).toBeInTheDocument();

    expect(screen.getByText('weather')).toBeInTheDocument();
  });

  it('carries forward tool calls from spans without text to the next message with text', () => {
    const requestMessages = JSON.stringify([
      {role: 'user', content: 'Compare weather in Spain and Germany'},
    ]);

    // First generation span with text
    const generationNode1 = createMockNode({
      id: 'span-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Let me check the weather for Spain',
      },
    });

    // Tool execution spans (weather lookups)
    const toolNode1 = createMockToolNode({
      id: 'tool-1',
      toolName: 'weather',
      startTimestamp: 1500,
    });
    const toolNode2 = createMockToolNode({
      id: 'tool-2',
      toolName: 'weather',
      startTimestamp: 1600,
    });

    // Generation span WITHOUT text (only made a tool call, no response text)
    // This simulates when the LLM decides to call another tool without producing text
    const generationNode2 = createMockNode({
      id: 'span-2',
      startTimestamp: 2000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        // No GEN_AI_RESPONSE_TEXT - simulates a span that only made tool calls
      },
    });

    // Calculator tool execution
    const toolNode3 = createMockToolNode({
      id: 'tool-3',
      toolName: 'calculator',
      startTimestamp: 2500,
    });

    // Final generation span with text (shows the comparison results)
    const generationNode3 = createMockNode({
      id: 'span-3',
      startTimestamp: 3000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Here is the comparison',
      },
    });

    render(
      <MessagesPanel
        nodes={
          [
            generationNode1,
            toolNode1,
            toolNode2,
            generationNode2,
            toolNode3,
            generationNode3,
          ] as any
        }
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // The final message should show all tool calls (weather x2 from the skipped span + calculator)
    expect(screen.getByText('Here is the comparison')).toBeInTheDocument();

    // Should have 2 weather tags and 1 calculator tag
    expect(screen.getAllByText('weather')).toHaveLength(2);
    expect(screen.getByText('calculator')).toBeInTheDocument();
  });
});
