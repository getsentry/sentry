import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import {TraceAiSpans} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceAiSpans';
import {isEAPSpanNode} from 'sentry/views/performance/traceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

function makeAiNodes(ids: string[]): AITraceSpanNode[] {
  const tree = TraceTree.FromTrace(
    makeEAPTrace(
      ids.map(id =>
        makeEAPSpan({
          event_id: id,
          op: 'gen_ai.invoke_agent',
          description: id,
          start_timestamp: 1000,
          end_timestamp: 1000.5,
          additional_attributes: {
            [SpanFields.GEN_AI_OPERATION_TYPE]: 'agent',
            [SpanFields.GEN_AI_AGENT_NAME]: id,
          },
        })
      )
    ),
    {organization: OrganizationFixture(), replay: null}
  );
  return tree.root.findAllChildren<AITraceSpanNode>((node): node is AITraceSpanNode =>
    isEAPSpanNode(node)
  );
}

describe('TraceAiSpans', () => {
  const organization = OrganizationFixture();
  const initialRouterConfig = {
    location: {
      pathname: '/performance/trace/trace-id/',
      query: {tab: 'ai-spans', node: ['span-first-agent', 'txn-root']},
    },
  };

  beforeEach(() => {
    Element.prototype.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace/trace-id/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
  });

  it('links to the waterfall tab of the current trace when rendered', () => {
    render(
      <TraceAiSpans
        traceSlug="trace-id"
        nodes={makeAiNodes(['first-agent'])}
        isLoading={false}
        error={false}
      />,
      {organization, initialRouterConfig}
    );

    expect(screen.getByRole('button', {name: 'View in Full Trace'})).toHaveAttribute(
      'href',
      '/performance/trace/trace-id/?node=span-first-agent&node=txn-root&tab=waterfall'
    );
  });

  it('replaces the node in the URL when a span is selected', async () => {
    const {router} = render(
      <TraceAiSpans
        traceSlug="trace-id"
        nodes={makeAiNodes(['first-agent', 'second-agent'])}
        isLoading={false}
        error={false}
      />,
      {organization, initialRouterConfig}
    );

    await userEvent.click(screen.getByRole('button', {name: /^second-agent/}));

    await waitFor(() => expect(router.location.query.node).toBe('span-second-agent'));
    expect(router.location.query.tab).toBe('ai-spans');
    expect(router.historyAction).toBe('REPLACE');
  });
});
