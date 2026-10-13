import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {useConversation} from 'sentry/views/explore/conversations/hooks/useConversation';
import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
import {getIsAiAgentNode} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {SpanFields} from 'sentry/views/insights/types';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

function createTimelineNode(
  id: string,
  operation: string,
  parent: EapSpanNode | null = null
) {
  return new EapSpanNode(
    parent,
    makeEAPSpan({
      event_id: id,
      op: `gen_ai.${operation}`,
      additional_attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: operation,
        [SpanFields.GEN_AI_AGENT_NAME]: id,
        [SpanFields.GEN_AI_TOOL_NAME]: id,
        [SpanFields.GEN_AI_RESPONSE_MODEL]: id,
      },
    }),
    {organization: OrganizationFixture()}
  );
}

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
    expect(
      getEmotionRules(screen.getByRole('button', {name: /^cycle-agent/})).join(' ')
    ).toMatch(/padding(?:-left)?:\s*4px;/);
  });

  it('indents nested agents and their calls by their agent ancestors', async () => {
    const lead = createTimelineNode('lead-agent', 'agent');
    const tool = createTimelineNode('lead-tool', 'tool', lead);
    const child = createTimelineNode('child-agent', 'agent', tool);
    const childCall = createTimelineNode('child-model', 'ai_client', child);
    const grandchild = createTimelineNode('grandchild-agent', 'agent', child);
    const grandchildCall = createTimelineNode(
      'grandchild-model',
      'ai_client',
      grandchild
    );
    const sibling = createTimelineNode('sibling-agent', 'agent', lead);
    const unrelated = createTimelineNode('unrelated-model', 'ai_client');
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

    expect(
      getEmotionRules(screen.getByRole('button', {name: /^lead-agent/})).join(' ')
    ).toMatch(/padding(?:-left)?:\s*4px;/);
    expect(
      getEmotionRules(screen.getByRole('button', {name: /^lead-tool/})).join(' ')
    ).toMatch(/(?:padding-left:\s*16px|padding:\s*4px 4px 4px 16px);/);
    expect(
      getEmotionRules(screen.getByRole('button', {name: /^child-agent/})).join(' ')
    ).toMatch(/(?:padding-left:\s*16px|padding:\s*4px 4px 4px 16px);/);
    expect(
      getEmotionRules(screen.getByRole('button', {name: /^child-model/})).join(' ')
    ).toMatch(/(?:padding-left:\s*32px|padding:\s*4px 4px 4px 32px);/);
    expect(
      getEmotionRules(screen.getByRole('button', {name: /^grandchild-agent/})).join(' ')
    ).toMatch(/(?:padding-left:\s*32px|padding:\s*4px 4px 4px 32px);/);
    expect(
      getEmotionRules(screen.getByRole('button', {name: /^grandchild-model/})).join(' ')
    ).toMatch(/(?:padding-left:\s*48px|padding:\s*4px 4px 4px 48px);/);
    expect(
      getEmotionRules(screen.getByRole('button', {name: /^sibling-agent/})).join(' ')
    ).toMatch(/(?:padding-left:\s*16px|padding:\s*4px 4px 4px 16px);/);
    expect(
      getEmotionRules(screen.getByRole('button', {name: /^unrelated-model/})).join(' ')
    ).toMatch(/padding(?:-left)?:\s*4px;/);

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
