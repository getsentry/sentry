import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
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
});
