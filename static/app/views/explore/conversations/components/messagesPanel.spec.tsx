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
  hasError?: boolean;
  startTimestamp?: number;
}) {
  const {id, toolName, startTimestamp = 1000, hasError = false} = overrides;
  const end = startTimestamp + 100;
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
});
