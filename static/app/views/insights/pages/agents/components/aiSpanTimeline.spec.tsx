import {AiTraceSpanNodeFixture} from 'sentry-fixture/aiTraceSpanNode';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';
import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
import {getIsAiAgentNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {SpanFields} from 'sentry/views/insights/types';
function createMockNode(id: string, attributes: Record<string, string | number>) {
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.evaluate',
    description: 'evaluate typesafe/jev-1.13',
    startTimestamp: 1000,
    endTimestamp: 1000.5,
    value: {start_timestamp: 1000, end_timestamp: 1000.5},
    attributes: {[SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client', ...attributes},
    errors: new Set(),
    findParent: () => null,
  };
}

const EVALUATION_ATTRIBUTES = {
  [SpanFields.GEN_AI_OPERATION_NAME]: 'evaluate',
  [SpanFields.GEN_AI_REQUEST_MODEL]: 'typesafe/jev-1.13',
  [SpanFields.GEN_AI_RESPONSE_MODEL]: 'typesafe/jev-1.13-20260917',
  [SpanFields.GEN_AI_OUTPUT_MESSAGES]: JSON.stringify([
    {
      type: 'evaluation',
      answers: {
        authIssue: {type: 'boolean', probability: 0.97},
        department: {type: 'choice', choice: 'billing'},
      },
    },
  ]),
};

describe('AiSpanTimeline', () => {
  it('renders an agent when conversation parent links contain a non-agent cycle', async () => {
    const organization = OrganizationFixture();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/cyclic-parents/`,
      body: {
        conversationId: 'cyclic-parents',
        title: null,
        stats: null,
        spans: [
          {id: 'cycle-agent', parent: 'tool-a', operation: 'agent'},
          {id: 'tool-a', parent: 'tool-b', operation: 'tool'},
          {id: 'tool-b', parent: 'tool-a', operation: 'tool'},
        ].map(({id, parent, operation}) => ({
          'gen_ai.conversation.id': 'cyclic-parents',
          'gen_ai.agent.name': id,
          'gen_ai.operation.type': operation,
          'precise.start_ts': 1000,
          'precise.finish_ts': 1000.5,
          project: 'test-project',
          'project.id': 1,
          'span.name': `gen_ai.${operation}`,
          'span.status': 'ok',
          span_id: id,
          parent_span: parent,
          trace: 'synthetic-trace',
        })),
      },
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'cyclic-parents'}),
      {organization}
    );
    await waitFor(() => expect(result.current.nodes).toHaveLength(3));

    render(
      <AiSpanTimeline
        nodes={result.current.nodes.filter(getIsAiAgentNode)}
        selectedNodeKey={null}
        onSelectNode={jest.fn()}
      />
    );
    expect(screen.getByRole('button', {name: /^cycle-agent/})).toBeInTheDocument();
  });

  it('selects a nested agent', async () => {
    const lead = AiTraceSpanNodeFixture({id: 'lead-agent', operation: 'agent'});
    const tool = AiTraceSpanNodeFixture({
      id: 'lead-tool',
      operation: 'tool',
      parent: lead,
    });
    const child = AiTraceSpanNodeFixture({
      id: 'child-agent',
      operation: 'agent',
      parent: tool,
    });
    const childCall = AiTraceSpanNodeFixture({
      id: 'child-model',
      operation: 'ai_client',
      parent: child,
    });
    const grandchild = AiTraceSpanNodeFixture({
      id: 'grandchild-agent',
      operation: 'agent',
      parent: child,
    });
    const grandchildCall = AiTraceSpanNodeFixture({
      id: 'grandchild-model',
      operation: 'ai_client',
      parent: grandchild,
    });
    const sibling = AiTraceSpanNodeFixture({
      id: 'sibling-agent',
      operation: 'agent',
      parent: lead,
    });
    const unrelated = AiTraceSpanNodeFixture({
      id: 'unrelated-model',
      operation: 'ai_client',
    });
    const onSelectNode = jest.fn();

    render(
      <AiSpanTimeline
        nodes={[
          lead,
          tool,
          child,
          childCall,
          grandchild,
          grandchildCall,
          sibling,
          unrelated,
        ]}
        selectedNodeKey={null}
        onSelectNode={onSelectNode}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /^grandchild-agent/}));
    expect(onSelectNode).toHaveBeenCalledWith(grandchild);
  });

  it('renders an evaluation with its evaluator and result', async () => {
    const onSelectNode = jest.fn();
    const node = createMockNode('eval-1', EVALUATION_ATTRIBUTES);
    render(
      <AiSpanTimeline
        nodes={[node] as any}
        selectedNodeKey={null}
        onSelectNode={onSelectNode}
      />
    );

    expect(screen.getByText('typesafe/jev-1.13')).toBeInTheDocument();
    expect(screen.getByText('authIssue: Yes, department: billing')).toBeInTheDocument();

    await userEvent.click(screen.getByText('typesafe/jev-1.13'));

    expect(onSelectNode).toHaveBeenCalledWith(node);
  });

  it('renders other LLM calls by their response model', () => {
    render(
      <AiSpanTimeline
        nodes={
          [
            createMockNode('gen-1', {
              [SpanFields.GEN_AI_OPERATION_NAME]: 'chat',
              [SpanFields.GEN_AI_RESPONSE_MODEL]: 'claude-sonnet-5-5',
            }),
          ] as any
        }
        selectedNodeKey={null}
        onSelectNode={jest.fn()}
      />
    );

    expect(screen.getByText('claude-sonnet-5-5')).toBeInTheDocument();
    expect(screen.queryByText(/authIssue/)).not.toBeInTheDocument();
  });

  it('renders a memory span by its operation and preview', () => {
    render(
      <AiSpanTimeline
        nodes={
          [
            createMockNode('mem-1', {
              [SpanFields.GEN_AI_OPERATION_TYPE]: 'memory',
              [SpanFields.GEN_AI_OPERATION_NAME]: 'search_memory',
              [SpanFields.GEN_AI_MEMORY_STORE_ID]: 'user-prefs',
              [SpanFields.GEN_AI_MEMORY_QUERY_TEXT]: 'dietary preferences',
              [SpanFields.GEN_AI_MEMORY_RECORD_COUNT]: 3,
            }),
          ] as any
        }
        selectedNodeKey={null}
        onSelectNode={jest.fn()}
      />
    );

    expect(screen.getByText('search_memory')).toBeInTheDocument();
    expect(screen.getByText('“dietary preferences”')).toBeInTheDocument();
  });
});
