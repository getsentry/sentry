import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

import {MessagesPanel} from './messagesPanel';

function createMockNode(
  overrides: Partial<{
    attributes: Record<string, unknown>;
    id: string;
    startTimestamp: number;
  }> = {}
): AITraceSpanNode {
  return {
    id: overrides.id ?? 'test-node-1',
    type: 'span',
    value: {
      start_timestamp: overrides.startTimestamp ?? 1000,
    },
    attributes: overrides.attributes ?? {},
    startTimestamp: overrides.startTimestamp ?? 1000,
  } as unknown as AITraceSpanNode;
}

describe('MessagesPanel', () => {
  const mockOnSelectNode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty message when no nodes are provided', () => {
    render(
      <MessagesPanel nodes={[]} selectedNodeId={null} onSelectNode={mockOnSelectNode} />
    );

    expect(screen.getByText('No messages found')).toBeInTheDocument();
  });

  it('extracts user messages from gen_ai.input.messages attribute', () => {
    const inputMessages = JSON.stringify([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: [{type: 'text', text: 'Hello, how are you?'}]},
    ]);

    const node = createMockNode({
      id: 'node-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'I am doing well!',
      },
    });

    render(
      <MessagesPanel
        nodes={[node]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByText('I am doing well!')).toBeInTheDocument();
  });

  it('extracts user messages with string content format', () => {
    const inputMessages = JSON.stringify([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: 'What is the weather today?'},
    ]);

    const node = createMockNode({
      id: 'node-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'The weather is sunny!',
      },
    });

    render(
      <MessagesPanel
        nodes={[node]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('What is the weather today?')).toBeInTheDocument();
    expect(screen.getByText('The weather is sunny!')).toBeInTheDocument();
  });

  it('extracts user messages with parts format', () => {
    const inputMessages = JSON.stringify([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', parts: [{type: 'text', text: 'Calculate 2+2'}]},
    ]);

    const node = createMockNode({
      id: 'node-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'The answer is 4.',
      },
    });

    render(
      <MessagesPanel
        nodes={[node]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Calculate 2+2')).toBeInTheDocument();
    expect(screen.getByText('The answer is 4.')).toBeInTheDocument();
  });

  it('falls back to gen_ai.request.messages when gen_ai.input.messages is not available', () => {
    const requestMessages = JSON.stringify([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: 'Fallback message test'},
    ]);

    const node = createMockNode({
      id: 'node-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response to fallback',
      },
    });

    render(
      <MessagesPanel
        nodes={[node]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Fallback message test')).toBeInTheDocument();
    expect(screen.getByText('Response to fallback')).toBeInTheDocument();
  });

  it('extracts the last user message from conversation history', () => {
    const inputMessages = JSON.stringify([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: 'First user message'},
      {role: 'assistant', content: 'First assistant response'},
      {role: 'user', content: 'Second user message'},
    ]);

    const node = createMockNode({
      id: 'node-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response to second message',
      },
    });

    render(
      <MessagesPanel
        nodes={[node]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // Should show the last user message
    expect(screen.getByText('Second user message')).toBeInTheDocument();
    // Should not show the first user message (would be duplicate)
    expect(screen.queryByText('First user message')).not.toBeInTheDocument();
  });

  it('displays multiple conversation turns from multiple nodes', () => {
    const firstInputMessages = JSON.stringify([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: [{type: 'text', text: 'First question'}]},
    ]);

    const secondInputMessages = JSON.stringify([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: [{type: 'text', text: 'First question'}]},
      {role: 'assistant', content: [{type: 'text', text: 'First answer'}]},
      {role: 'user', content: [{type: 'text', text: 'Second question'}]},
    ]);

    const firstNode = createMockNode({
      id: 'node-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: firstInputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'First answer',
      },
    });

    const secondNode = createMockNode({
      id: 'node-2',
      startTimestamp: 2000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: secondInputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Second answer',
      },
    });

    render(
      <MessagesPanel
        nodes={[firstNode, secondNode]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('First question')).toBeInTheDocument();
    expect(screen.getByText('First answer')).toBeInTheDocument();
    expect(screen.getByText('Second question')).toBeInTheDocument();
    expect(screen.getByText('Second answer')).toBeInTheDocument();
  });

  it('displays user email when available', () => {
    const inputMessages = JSON.stringify([{role: 'user', content: 'Hello from user'}]);

    const node = createMockNode({
      id: 'node-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Hello!',
        [SpanFields.USER_EMAIL]: 'test@example.com',
      },
    });

    render(
      <MessagesPanel
        nodes={[node]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('only processes ai_client spans for messages', () => {
    const inputMessages = JSON.stringify([{role: 'user', content: 'User message'}]);

    const agentNode = createMockNode({
      id: 'agent-node',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'agent',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Agent response',
      },
    });

    const clientNode = createMockNode({
      id: 'client-node',
      startTimestamp: 1001,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Client response',
      },
    });

    render(
      <MessagesPanel
        nodes={[agentNode, clientNode]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // Should only show message from ai_client span
    expect(screen.getByText('Client response')).toBeInTheDocument();
    expect(screen.queryByText('Agent response')).not.toBeInTheDocument();
  });

  it('extracts assistant messages from gen_ai.output.messages when available', () => {
    const inputMessages = JSON.stringify([{role: 'user', content: 'Hello'}]);

    const outputMessages = JSON.stringify([
      {role: 'assistant', content: 'Hi from output messages!'},
    ]);

    const node = createMockNode({
      id: 'node-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
        [SpanFields.GEN_AI_OUTPUT_MESSAGES]: outputMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Fallback response text',
      },
    });

    render(
      <MessagesPanel
        nodes={[node]}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi from output messages!')).toBeInTheDocument();
    // Should use output.messages, not response.text
    expect(screen.queryByText('Fallback response text')).not.toBeInTheDocument();
  });
});
