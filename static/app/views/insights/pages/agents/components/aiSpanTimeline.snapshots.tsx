import {AiTraceSpanNodeFixture} from 'sentry-fixture/aiTraceSpanNode';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

import {AiSpanTimeline} from './aiSpanTimeline';

/**
 * A fixture span placed at `start` seconds into the run, with extra attributes,
 * e.g. a tool's name and arguments.
 */
function makeSpan({
  id,
  operation,
  parent,
  start,
  duration,
  attributes = {},
}: {
  duration: number;
  id: string;
  operation: string;
  start: number;
  attributes?: Record<string, string | number>;
  parent?: AITraceSpanNode;
}): AITraceSpanNode {
  const node = AiTraceSpanNodeFixture({id, operation, parent});
  return Object.assign(node, {
    startTimestamp: 1000 + start,
    endTimestamp: 1000 + start + duration,
    attributes: {...node.attributes, ...attributes},
  });
}

function makeTool(
  id: string,
  parent: AITraceSpanNode,
  start: number,
  toolName: string,
  {hasError = false}: {hasError?: boolean} = {}
) {
  return makeSpan({
    id,
    operation: 'tool',
    parent,
    start,
    duration: hasError ? 9.1 : 0.93,
    attributes: {
      [SpanFields.GEN_AI_TOOL_NAME]: toolName,
      'gen_ai.tool.call.arguments': JSON.stringify({
        repo_name: 'example/invoicing-apis',
        path: 'invoice_items/services/item_service.py',
      }),
      'gen_ai.tool.call.result': 'x'.repeat(hasError ? 123 : 2120),
      ...(hasError ? {[SpanFields.SPAN_STATUS]: 'internal_error'} : {}),
    },
  });
}

function makeModel(id: string, parent: AITraceSpanNode, start: number) {
  return makeSpan({
    id,
    operation: 'ai_client',
    parent,
    start,
    duration: 3.56,
    attributes: {
      [SpanFields.GEN_AI_RESPONSE_MODEL]: 'claude-opus-4-5',
      [SpanFields.GEN_AI_COST_TOTAL_TOKENS]: 0.0506,
    },
  });
}

describe('AiSpanTimeline', () => {
  it.snapshot(
    'indents nested spans at every level',
    () => {
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

      return (
        <Text as="div">
          <Container padding="md" background="primary">
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
              onSelectNode={() => {}}
            />
          </Container>
        </Text>
      );
    },
    {viewport: 800, tags: {area: 'core'}}
  );

  it.snapshot(
    'collapses sub-agents below maxDefaultDepth',
    () => {
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
      const leadCall = AiTraceSpanNodeFixture({
        id: 'lead-model',
        operation: 'ai_client',
        parent: lead,
      });

      return (
        <Text as="div">
          <Container padding="md" background="primary">
            <AiSpanTimeline
              nodes={[lead, tool, child, childCall, leadCall]}
              selectedNodeKey="lead-agent"
              maxDefaultDepth={2}
              onSelectNode={() => {}}
            />
          </Container>
        </Text>
      );
    },
    {viewport: 800, tags: {area: 'core'}}
  );

  it.snapshot(
    'shows an agent run with errored and selected tool calls',
    () => {
      const agent = makeSpan({id: 'autofix', operation: 'agent', start: 0, duration: 60});
      const nodes = [
        agent,
        makeModel('model-1', agent, 1),
        makeTool('tool-1', agent, 5, 'Get Issue Details'),
        makeTool('tool-2', agent, 6, 'Read File', {hasError: true}),
        makeTool('tool-3', agent, 16, 'Read File', {hasError: true}),
        makeModel('model-2', agent, 18),
        makeTool('tool-4', agent, 23, 'Bash'),
        makeTool('tool-5', agent, 25, 'Bash'),
        makeModel('model-3', agent, 40),
      ];

      return (
        <Text as="div">
          <Container padding="md" background="primary">
            <AiSpanTimeline
              nodes={nodes}
              selectedNodeKey="tool-3"
              onSelectNode={() => {}}
            />
          </Container>
        </Text>
      );
    },
    {viewport: 1000, tags: {area: 'core'}}
  );
});
