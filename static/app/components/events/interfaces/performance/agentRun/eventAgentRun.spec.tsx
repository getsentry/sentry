import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderHookWithProviders,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  makeEAPError,
  makeEAPSpan,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {EventAgentActivity, OpenAgentActivityButton} from './eventAgentRun';
import {getEventAgentRun, useEventAgentRun} from './useEventAgentRun';

const organization = OrganizationFixture({features: ['performance-view']});
const traceId = 'a'.repeat(32);
const errorEventId = 'b'.repeat(32);
const event = EventFixture({
  eventID: errorEventId,
  groupID: '1',
  contexts: {trace: {trace_id: traceId}},
});

function makeTrace({errorInsideTool}: {errorInsideTool: boolean}) {
  const error = makeEAPError({event_id: errorEventId});
  const tool = makeEAPSpan({
    event_id: 'tool-span',
    op: 'gen_ai.execute_tool',
    name: 'gen_ai.execute_tool',
    description: 'execute_tool search_docs',
    start_timestamp: 2,
    end_timestamp: 3,
    additional_attributes: {
      'gen_ai.operation.type': 'tool',
      'gen_ai.tool.name': 'search_docs',
    },
    children: [
      makeEAPSpan({
        event_id: 'http-span',
        op: 'http.client',
        start_timestamp: 2,
        end_timestamp: 3,
        errors: errorInsideTool ? [error] : [],
      }),
    ],
  });
  const agent = makeEAPSpan({
    event_id: 'agent-span',
    op: 'gen_ai.invoke_agent',
    name: 'gen_ai.invoke_agent',
    description: 'invoke_agent support-agent',
    start_timestamp: 1,
    end_timestamp: 5,
    additional_attributes: {
      'gen_ai.operation.type': 'agent',
      'gen_ai.agent.name': 'support-agent',
    },
    children: [
      makeEAPSpan({
        event_id: 'chat-span',
        op: 'gen_ai.chat',
        name: 'gen_ai.chat',
        description: 'chat claude-sonnet-4',
        start_timestamp: 1,
        end_timestamp: 2,
        additional_attributes: {
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.request.model': 'claude-sonnet-4',
        },
      }),
      tool,
    ],
  });

  return [
    makeEAPSpan({
      event_id: 'root-span',
      op: 'http.server',
      is_transaction: true,
      start_timestamp: 0,
      end_timestamp: 6,
      errors: errorInsideTool ? [] : [error],
      children: [agent],
    }),
  ];
}

describe('getEventAgentRun', () => {
  it('finds the agent run and the step the error was raised in', () => {
    const agentRun = getEventAgentRun(
      makeTrace({errorInsideTool: true}),
      errorEventId,
      organization
    );

    expect(agentRun.type).toBe('inside');
    if (agentRun.type !== 'inside') {
      return;
    }
    expect(agentRun.runNode.id).toBe('agent-span');
    expect(agentRun.failingNode.id).toBe('tool-span');
    expect(agentRun.nodes.map(node => node.id)).toEqual([
      'agent-span',
      'chat-span',
      'tool-span',
    ]);
  });

  it('counts agent runs when the error was raised outside them', () => {
    expect(
      getEventAgentRun(makeTrace({errorInsideTool: false}), errorEventId, organization)
    ).toEqual({type: 'elsewhere', agentRunCount: 1});
  });

  it('returns none for a trace without AI spans', () => {
    const trace = [
      makeEAPSpan({
        event_id: 'root-span',
        is_transaction: true,
        errors: [makeEAPError({event_id: errorEventId})],
      }),
    ];

    expect(getEventAgentRun(trace, errorEventId, organization)).toEqual({type: 'none'});
  });
});

describe('useEventAgentRun', () => {
  it('does not fetch the trace when disabled', () => {
    const traceRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace/${traceId}/`,
      body: makeTrace({errorInsideTool: true}),
    });

    const {result} = renderHookWithProviders(
      () => useEventAgentRun(event, {enabled: false}),
      {organization}
    );

    expect(result.current).toEqual({type: 'none'});
    expect(traceRequest).not.toHaveBeenCalled();
  });
  it('reports loading until the trace is fetched', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace/${traceId}/`,
      body: makeTrace({errorInsideTool: true}),
    });

    const {result} = renderHookWithProviders(
      () => useEventAgentRun(event, {enabled: true}),
      {organization}
    );

    expect(result.current).toEqual({type: 'loading'});
    await waitFor(() => expect(result.current.type).toBe('inside'));
  });
});

describe('EventAgentActivity', () => {
  it('summarizes the agent run and the failing step', () => {
    const agentRun = getEventAgentRun(
      makeTrace({errorInsideTool: true}),
      errorEventId,
      organization
    );

    render(<EventAgentActivity agentRun={agentRun} event={event} />, {organization});

    expect(screen.getAllByText('support-agent').length).toBeGreaterThan(0);
    expect(screen.getAllByText('claude-sonnet-4').length).toBeGreaterThan(0);
    expect(screen.getByText('execute_tool search_docs')).toBeInTheDocument();
  });

  it('only shows the steps around the failing step in a long run', () => {
    const steps = Array.from({length: 12}, (_, index) =>
      makeEAPSpan({
        event_id: `tool-span-${index}`,
        op: 'gen_ai.execute_tool',
        name: 'gen_ai.execute_tool',
        description: `execute_tool step_${index}`,
        start_timestamp: index + 1,
        end_timestamp: index + 2,
        additional_attributes: {
          'gen_ai.operation.type': 'tool',
          'gen_ai.tool.name': `step_${index}`,
        },
        errors: index === 6 ? [makeEAPError({event_id: errorEventId})] : [],
      })
    );
    const trace = [
      makeEAPSpan({
        event_id: 'agent-span',
        op: 'gen_ai.invoke_agent',
        name: 'gen_ai.invoke_agent',
        description: 'invoke_agent support-agent',
        is_transaction: true,
        start_timestamp: 0,
        end_timestamp: 14,
        additional_attributes: {'gen_ai.operation.type': 'agent'},
        children: steps,
      }),
    ];

    render(
      <EventAgentActivity
        agentRun={getEventAgentRun(trace, errorEventId, organization)}
        event={event}
      />,
      {organization}
    );

    // The run has 13 rows: the agent span and 12 steps. The failing step is row 7.
    expect(screen.queryByText('step_2')).not.toBeInTheDocument();
    expect(screen.getByText('step_3')).toBeInTheDocument();
    expect(screen.getByText('step_9')).toBeInTheDocument();
    expect(screen.queryByText('step_10')).not.toBeInTheDocument();

    const earlier = screen.getByRole('link', {name: '4 more steps'});
    expect(earlier).toHaveAttribute('href', expect.stringContaining('tab=ai-spans'));
    expect(earlier).toHaveAttribute(
      'href',
      expect.stringContaining('node=span-tool-span-6')
    );
    expect(screen.getByRole('link', {name: '2 more steps'})).toBeInTheDocument();
  });

  it('says when the error was raised outside the agent runs', () => {
    render(
      <EventAgentActivity
        agentRun={{type: 'elsewhere', agentRunCount: 2}}
        event={event}
      />,
      {organization}
    );

    expect(
      screen.getByText(
        'This error was raised outside the 2 agent runs in this trace, which may give context for it.'
      )
    ).toBeInTheDocument();
  });
});

describe('OpenAgentActivityButton', () => {
  it('links to the failing step in the Agent Activity tab', () => {
    const agentRun = getEventAgentRun(
      makeTrace({errorInsideTool: true}),
      errorEventId,
      organization
    );

    render(<OpenAgentActivityButton agentRun={agentRun} event={event} />, {
      organization,
    });

    const link = screen.getByRole('button', {name: 'Open Agent Activity'});
    expect(link).toHaveAttribute('href', expect.stringContaining(`/trace/${traceId}/`));
    expect(link).toHaveAttribute('href', expect.stringContaining('tab=ai-spans'));
    expect(link).toHaveAttribute('href', expect.stringContaining('node=span-tool-span'));
  });
});
