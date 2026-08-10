import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EMPTY_TEXT_CONTENT} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';
import {SpanFields} from 'sentry/views/insights/types';

import {MessagesPanel} from './messagesPanel';

function createMockNode(overrides: {
  id: string;
  attributes?: Record<string, string | number>;
  endTimestamp?: number;
  startTimestamp?: number;
}) {
  const {id, attributes = {}, startTimestamp = 1000, endTimestamp} = overrides;
  const end = endTimestamp ?? startTimestamp + 100;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.generate',
    startTimestamp,
    endTimestamp: end,
    value: {start_timestamp: startTimestamp, end_timestamp: end},
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
      ...attributes,
    },
    errors: new Set(),
  };
}

function createMockToolNode(overrides: {
  id: string;
  toolName: string;
  endTimestamp?: number;
  hasError?: boolean;
  output?: string;
  startTimestamp?: number;
}) {
  const {
    id,
    toolName,
    startTimestamp = 1000,
    hasError = false,
    output,
    endTimestamp,
  } = overrides;
  const end = endTimestamp ?? startTimestamp + 100;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.execute_tool',
    startTimestamp,
    endTimestamp: end,
    value: {start_timestamp: startTimestamp, end_timestamp: end},
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'tool',
      [SpanFields.GEN_AI_TOOL_NAME]: toolName,
      ...(hasError ? {[SpanFields.SPAN_STATUS]: 'internal_error'} : {}),
      ...(output === undefined ? {} : {'gen_ai.tool.call.result': output}),
    },
    errors: new Set(),
  };
}

// Mirrors the node `useConversation` produces for an embeddings span: the op
// type stays "ai_client" (the ingestion-computed gen_ai.operation.type has no
// embeddings bucket) and it's recognized by its span op. `input` may be absent
// on older deploys, in which case the row falls back to the model.
function createMockEmbeddingNode(overrides: {
  id: string;
  endTimestamp?: number;
  input?: string;
  model?: string;
  startTimestamp?: number;
  tokens?: number;
}) {
  const {
    id,
    input = 'search query',
    model = 'text-embedding-005',
    startTimestamp = 1000,
    endTimestamp,
    tokens,
  } = overrides;
  const end = endTimestamp ?? startTimestamp + 100;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.embeddings',
    startTimestamp,
    endTimestamp: end,
    value: {start_timestamp: startTimestamp, end_timestamp: end},
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
      [SpanFields.SPAN_OP]: 'gen_ai.embeddings',
      [SpanFields.GEN_AI_EMBEDDINGS_INPUT]: input,
      [SpanFields.GEN_AI_RESPONSE_MODEL]: model,
      ...(tokens === undefined ? {} : {[SpanFields.GEN_AI_USAGE_TOTAL_TOKENS]: tokens}),
    },
    errors: new Set(),
  };
}

// Builds a turn whose assistant message carries `toolNames.length` tool calls,
// with the tool spans sitting between two generations so they merge onto the
// second turn.
function createNodesWithToolCalls(
  toolNames: string[],
  {errorToolNames = []}: {errorToolNames?: string[]} = {}
) {
  const requestMessages = JSON.stringify([{role: 'user', content: 'Question?'}]);
  const firstGeneration = createMockNode({
    id: 'span-1',
    startTimestamp: 1000,
    attributes: {
      [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
      [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Let me check',
    },
  });
  const toolNodes = toolNames.map((toolName, index) =>
    createMockToolNode({
      id: `tool-${index}`,
      toolName,
      startTimestamp: 1500 + index * 100,
      hasError: errorToolNames.includes(toolName),
    })
  );
  const secondGeneration = createMockNode({
    id: 'span-2',
    startTimestamp: 3000,
    attributes: {
      [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
      [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Here is the answer',
    },
  });
  return [firstGeneration, ...toolNodes, secondGeneration];
}

describe('MessagesPanel', () => {
  const mockOnSelectNode = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('explains when a conversation has no inference spans', () => {
    const toolNode = createMockToolNode({id: 'tool-1', toolName: 'search'});

    render(
      <MessagesPanel
        nodes={[toolNode] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(
      screen.getByText("This conversation doesn't include any inference spans")
    ).toBeInTheDocument();
    expect(screen.queryByText('No messages found')).not.toBeInTheDocument();
  });

  it('offers a shortcut to the Timeline when there are no inference spans', async () => {
    const onViewTimeline = jest.fn();
    const toolNode = createMockToolNode({id: 'tool-1', toolName: 'search'});

    render(
      <MessagesPanel
        nodes={[toolNode] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
        onViewTimeline={onViewTimeline}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'View Timeline'}));
    expect(onViewTimeline).toHaveBeenCalledTimes(1);
  });

  it('warns and links to docs when inference spans captured no input/output', () => {
    // A generation span exists, but it carries no request/response content.
    const node = createMockNode({id: 'span-1'});

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(
      screen.getByText("This conversation's messages weren't captured")
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'Enable capturing inputs and outputs'})
    ).toBeInTheDocument();
  });

  it('renders user and assistant messages', () => {
    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: JSON.stringify([
          {role: 'user', content: 'Hello there'},
        ]),
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

    expect(screen.getByText('Hello there')).toBeInTheDocument();
    expect(screen.getByText('Assistant response text')).toBeInTheDocument();
  });

  it('does not render an agent header (name/model/email)', () => {
    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: JSON.stringify([
          {role: 'user', content: 'User message'},
        ]),
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response',
        [SpanFields.GEN_AI_AGENT_NAME]: 'my-cool-agent',
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

    expect(screen.queryByText('my-cool-agent')).not.toBeInTheDocument();
    expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
    expect(screen.queryByText('Assistant')).not.toBeInTheDocument();
  });

  it('renders a placeholder when output text content is missing', () => {
    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: JSON.stringify([
          {role: 'user', content: 'User message'},
        ]),
        [SpanFields.GEN_AI_OUTPUT_MESSAGES]: JSON.stringify([
          {role: 'assistant', content: [{type: 'text', chars: 56}]},
        ]),
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText(EMPTY_TEXT_CONTENT)).toBeInTheDocument();
  });

  it('displays tool calls on assistant messages', () => {
    const requestMessages = JSON.stringify([{role: 'user', content: 'Weather?'}]);
    const generationNode1 = createMockNode({
      id: 'span-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Let me check',
      },
    });
    const toolNode1 = createMockToolNode({
      id: 'tool-1',
      toolName: 'weather',
      startTimestamp: 1500,
    });
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

    expect(screen.getByText('weather')).toBeInTheDocument();
  });

  it('renders a short run of tool calls inline without a summary', () => {
    render(
      <MessagesPanel
        nodes={createNodesWithToolCalls(['alpha', 'beta', 'gamma']) as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('gamma')).toBeInTheDocument();
    expect(screen.queryByText('3 tool calls')).not.toBeInTheDocument();
  });

  it('collapses a long run of tool calls behind a summary and expands on click', async () => {
    render(
      <MessagesPanel
        nodes={createNodesWithToolCalls(['t1', 't2', 't3', 't4', 't5']) as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // Collapsed by default: the summary is shown inside a closed details.
    const summary = screen.getByText('5 tool calls');
    expect(summary).toBeInTheDocument();
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');

    // Expanding reveals every tool call.
    await userEvent.click(summary);
    expect(details).toHaveAttribute('open');
    expect(screen.getByText('t1')).toBeInTheDocument();
    expect(screen.getByText('t5')).toBeInTheDocument();
  });

  it('shows the error count in the tool call summary', () => {
    render(
      <MessagesPanel
        nodes={
          createNodesWithToolCalls(['t1', 't2', 't3', 't4', 't5'], {
            errorToolNames: ['t2', 't4'],
          }) as any
        }
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('5 tool calls')).toBeInTheDocument();
    expect(screen.getByText('2 errors')).toBeInTheDocument();
  });

  it('summarizes the combined output size and time in the tool call summary', () => {
    const requestMessages = JSON.stringify([{role: 'user', content: 'Question?'}]);
    const firstGeneration = createMockNode({
      id: 'span-1',
      startTimestamp: 1000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Let me check',
      },
    });
    // Five calls, each 30 bytes of output over 0.1s, so the summary totals
    // 150 B across 500.00ms — distinct from every per-row "30 B" / "100.00ms".
    const toolNodes = Array.from({length: 5}, (_, index) => {
      const start = 1500 + index * 100;
      return createMockToolNode({
        id: `tool-${index}`,
        toolName: `t${index}`,
        startTimestamp: start,
        endTimestamp: start + 0.1,
        output: 'x'.repeat(30),
      });
    });
    const secondGeneration = createMockNode({
      id: 'span-2',
      startTimestamp: 3000,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Here is the answer',
      },
    });

    render(
      <MessagesPanel
        nodes={[firstGeneration, ...toolNodes, secondGeneration] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('5 tool calls')).toBeInTheDocument();
    expect(screen.getByText('150 B')).toBeInTheDocument();
    expect(screen.getByText('500.00ms')).toBeInTheDocument();
  });

  it('expands the tool call group when one of its calls is selected', () => {
    render(
      <MessagesPanel
        nodes={createNodesWithToolCalls(['t1', 't2', 't3', 't4', 't5']) as any}
        selectedNodeId="tool-1"
        onSelectNode={mockOnSelectNode}
      />
    );

    const details = screen.getByText('5 tool calls').closest('details');
    expect(details).toHaveAttribute('open');
  });

  it('selects assistant messages on click but not user messages', async () => {
    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: JSON.stringify([
          {role: 'user', content: 'Hello there'},
        ]),
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Assistant response',
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // User messages are not interactive
    await userEvent.click(screen.getByText('Hello there'));
    expect(mockOnSelectNode).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: /Hello there/})).not.toBeInTheDocument();

    // Assistant messages select the corresponding node
    await userEvent.click(screen.getByText('Assistant response'));
    expect(mockOnSelectNode).toHaveBeenCalledWith(node);
    expect(
      screen.getByText('Assistant response').closest('[role="button"]')
    ).toBeInTheDocument();
  });

  it('keeps reasoning text in the DOM inside a collapsed details element', () => {
    const node = createMockNode({
      id: 'span-1',
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: JSON.stringify([
          {role: 'user', content: 'User message'},
        ]),
        [SpanFields.GEN_AI_OUTPUT_MESSAGES]: JSON.stringify([
          {
            role: 'assistant',
            parts: [
              {type: 'reasoning', content: 'My secret thinking text'},
              {type: 'text', text: 'The final answer'},
            ],
          },
        ]),
      },
    });

    render(
      <MessagesPanel
        nodes={[node] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // The reasoning appears both as the collapsed preview and the full content.
    const matches = screen.getAllByText('My secret thinking text');
    expect(matches.length).toBeGreaterThan(0);
    const details = matches[0]!.closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
  });

  it('renders an embeddings-only conversation instead of the no-inference-spans notice', () => {
    const embeddingNode = createMockEmbeddingNode({id: 'embed-1', input: 'find docs'});

    render(
      <MessagesPanel
        nodes={[embeddingNode] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(
      screen.queryByText("This conversation doesn't include any inference spans")
    ).not.toBeInTheDocument();
    expect(screen.getByText('Creating embedding...')).toBeInTheDocument();
  });

  it('shows no preview in the toggle and reveals the input only when expanded', async () => {
    const embeddingNode = createMockEmbeddingNode({
      id: 'embed-1',
      input: 'a very specific search query',
    });

    render(
      <MessagesPanel
        nodes={[embeddingNode] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    // The toggle label carries no preview of the input — the input lives in the
    // collapsible body (kept in the DOM by the native <details>), not the summary.
    const toggle = screen.getByText('Creating embedding...');
    const summary = toggle.closest('summary');
    expect(summary).not.toBeNull();
    const details = toggle.closest('details');
    expect(details).not.toHaveAttribute('open');

    const inputEl = screen.getByText('a very specific search query');
    expect(summary).not.toContainElement(inputEl);

    await userEvent.click(toggle);
    expect(details).toHaveAttribute('open');
    expect(inputEl).toBeInTheDocument();
  });

  it('does not render an embedding row when the input is unavailable', () => {
    // The dev-ui/older-deploy shape: an embeddings span with no
    // gen_ai.embeddings.input in the bulk response. Without the input there's
    // nothing worth showing, so the row is dropped entirely.
    const embeddingNode = createMockEmbeddingNode({
      id: 'embed-1',
      input: '',
      model: 'text-embedding-005',
    });

    render(
      <MessagesPanel
        nodes={[embeddingNode] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.queryByText('Creating embedding...')).not.toBeInTheDocument();
  });

  it('shows the token count in the embedding meta when available', () => {
    const embeddingNode = createMockEmbeddingNode({
      id: 'embed-1',
      input: 'find docs',
      tokens: 6,
    });

    render(
      <MessagesPanel
        nodes={[embeddingNode] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    expect(screen.getByText('tokens')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('positions the embedding row between the user and assistant turns around it', () => {
    // A wide generation span (1000 -> 1200) so the embedding's own timestamp
    // (1150) falls between the user turn's timestamp (the span's start, 1000)
    // and the assistant turn's timestamp (the span's end, 1200).
    const node = createMockNode({
      id: 'span-1',
      startTimestamp: 1000,
      endTimestamp: 1200,
      attributes: {
        [SpanFields.GEN_AI_REQUEST_MESSAGES]: JSON.stringify([
          {role: 'user', content: 'Find the docs'},
        ]),
        [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Here they are',
      },
    });
    const embeddingNode = createMockEmbeddingNode({
      id: 'embed-1',
      input: 'find docs embedding',
      startTimestamp: 1050,
      endTimestamp: 1150,
    });

    const {container} = render(
      <MessagesPanel
        nodes={[node, embeddingNode] as any}
        selectedNodeId={null}
        onSelectNode={mockOnSelectNode}
      />
    );

    const text = container.textContent ?? '';
    expect(text.indexOf('Find the docs')).toBeLessThan(
      text.indexOf('Creating embedding...')
    );
    expect(text.indexOf('Creating embedding...')).toBeLessThan(
      text.indexOf('Here they are')
    );
  });
});
