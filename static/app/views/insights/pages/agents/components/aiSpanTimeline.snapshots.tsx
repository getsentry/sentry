import {AiTraceSpanNodeFixture} from 'sentry-fixture/aiTraceSpanNode';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';

describe('AiSpanTimeline', () => {
  it.snapshot(
    'indents nested agents and their calls by their agent ancestors',
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
});
