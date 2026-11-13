import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {EventOrGroupType} from 'sentry/types/event';
import {
  makeEAPError,
  makeEAPSpan,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {AgentRunHighlights} from './agentRunHighlights';
import {getAgentRunStepBreakdown} from './useAgentRunStepBreakdown';

const organization = OrganizationFixture({
  features: ['performance-view', 'issue-details-agent-run'],
});
const traceId = 'a'.repeat(32);
const errorEventId = 'b'.repeat(32);
const event = EventFixture({
  eventID: errorEventId,
  groupID: '1',
  projectID: '2',
  type: EventOrGroupType.ERROR,
  // Raised during the tool span, which runs from 2s to 3s.
  dateCreated: new Date(2_500).toISOString(),
  contexts: {trace: {trace_id: traceId}},
});

function makeTrace({
  agentStatus = 'ok',
  stepsAfterError = 0,
}: {agentStatus?: string; stepsAfterError?: number} = {}) {
  return [
    makeEAPSpan({
      event_id: 'agent-span',
      op: 'gen_ai.invoke_agent',
      description: 'invoke_agent support-agent',
      is_transaction: true,
      start_timestamp: 1,
      end_timestamp: 5,
      additional_attributes: {
        'gen_ai.operation.type': 'agent',
        'gen_ai.agent.name': 'support-agent',
        'span.status': agentStatus,
      },
      children: [
        makeEAPSpan({
          event_id: 'chat-span',
          op: 'gen_ai.chat',
          description: 'chat claude-sonnet-4',
          start_timestamp: 1,
          end_timestamp: 2,
          additional_attributes: {
            'gen_ai.operation.type': 'ai_client',
            'gen_ai.response.model': 'claude-sonnet-4',
          },
        }),
        makeEAPSpan({
          event_id: 'tool-span',
          op: 'gen_ai.execute_tool',
          description: 'execute_tool search_docs',
          start_timestamp: 2,
          end_timestamp: 3,
          additional_attributes: {
            'gen_ai.operation.type': 'tool',
            'gen_ai.tool.name': 'search_docs',
            'gen_ai.tool.call.arguments': '{"query": "rate limits"}',
          },
          errors: [makeEAPError({event_id: errorEventId})],
        }),
        ...Array.from({length: stepsAfterError}, (_, index) =>
          makeEAPSpan({
            event_id: `later-span-${index}`,
            op: 'gen_ai.chat',
            description: 'chat claude-sonnet-4',
            start_timestamp: 3 + index * 0.1,
            end_timestamp: 3.05 + index * 0.1,
            additional_attributes: {'gen_ai.operation.type': 'ai_client'},
          })
        ),
      ],
    }),
  ];
}

function mockRecentEvents(spans: Array<{id: string; 'gen_ai.tool.name'?: string}>) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    match: [MockApiClient.matchQuery({dataset: 'errors'})],
    body: {
      data: spans.map(span => ({trace: traceId, 'trace.span': span.id})),
    },
  });
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    match: [
      MockApiClient.matchQuery({
        dataset: 'spans',
        referrer: 'issue_details.agent_run.recent_error_spans',
      }),
    ],
    body: {
      data: spans.map(span => ({...span, 'span.op': 'gen_ai.execute_tool'})),
    },
  });
}

describe('getAgentRunStepBreakdown', () => {
  it('counts the steps that events were raised in, ignoring spans that were not found', () => {
    const breakdown = getAgentRunStepBreakdown(
      [
        {trace: 't1', 'trace.span': 's1'},
        {trace: 't1', 'trace.span': 's2'},
        {trace: 't2', 'trace.span': 's3'},
        {trace: 't3', 'trace.span': 'missing'},
        {trace: 't3', 'trace.span': 'http'},
      ],
      [
        {id: 's1', 'span.op': 'gen_ai.execute_tool', 'gen_ai.tool.name': 'run_query'},
        {id: 's2', 'span.op': 'gen_ai.execute_tool', 'gen_ai.tool.name': 'run_query'},
        {id: 's3', 'span.op': 'gen_ai.chat'},
        {id: 'http', 'span.op': 'http.client'},
      ]
    );

    expect(breakdown).toEqual({
      sampledEvents: 5,
      matchedEvents: 3,
      steps: [
        {step: 'run_query', count: 2, spanIds: ['s1', 's2']},
        {step: 'gen_ai.chat', count: 1, spanIds: ['s3']},
      ],
      traceIds: ['t1', 't2', 't3'],
    });
  });
});

describe('AgentRunHighlights', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: event.projectID, hasInsightsAgentMonitoring: true}),
    ]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          dataset: 'spans',
          referrer: 'api.issues.agent-run.has-active-ai-span',
        }),
      ],
      body: {data: [{id: 'tool-span'}]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace/${traceId}/`,
      body: makeTrace(),
    });
  });

  it('shows the agent, failed step, model, and tool input of the event', async () => {
    mockRecentEvents([]);
    render(<AgentRunHighlights event={event} />, {organization});

    expect(await screen.findByText('Agent run')).toBeInTheDocument();
    expect(screen.getByText('support-agent')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'search_docs'})).toBeInTheDocument();
    expect(screen.getByText('· step 3 of 3')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4')).toBeInTheDocument();
    expect(screen.getByText('Tool input')).toBeInTheDocument();
    expect(screen.getByText('The run ended at this step')).toBeInTheDocument();
    expect(screen.queryByText('Across events')).not.toBeInTheDocument();
  });

  it('says when the agent continued after the error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace/${traceId}/`,
      body: makeTrace({stepsAfterError: 2}),
    });
    mockRecentEvents([]);
    render(<AgentRunHighlights event={event} />, {organization});

    expect(await screen.findByText('After the error')).toBeInTheDocument();
    expect(screen.getByText('The agent continued for 2 more steps')).toBeInTheDocument();
  });

  it('says when the run failed after the error', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace/${traceId}/`,
      body: makeTrace({agentStatus: 'internal_error', stepsAfterError: 1}),
    });
    mockRecentEvents([]);
    render(<AgentRunHighlights event={event} />, {organization});

    expect(
      await screen.findByText('The agent took 1 more step, then the run failed')
    ).toBeInTheDocument();
  });

  it('hides Across events when every recent event failed in this step', async () => {
    const spansRequest = mockRecentEvents([
      {id: 's1', 'gen_ai.tool.name': 'search_docs'},
      {id: 's2', 'gen_ai.tool.name': 'search_docs'},
      {id: 's3', 'gen_ai.tool.name': 'search_docs'},
    ]);
    render(<AgentRunHighlights event={event} />, {organization});

    expect(await screen.findByText('Agent run')).toBeInTheDocument();
    await waitFor(() => expect(spansRequest).toHaveBeenCalled());
    expect(screen.queryByText('Across events')).not.toBeInTheDocument();
  });

  it('shows Across events when recent events failed in another step', async () => {
    mockRecentEvents([
      {id: 's1', 'gen_ai.tool.name': 'fetch_page'},
      {id: 's2', 'gen_ai.tool.name': 'fetch_page'},
      {id: 's3', 'gen_ai.tool.name': 'fetch_page'},
    ]);
    render(<AgentRunHighlights event={event} />, {organization});

    expect(await screen.findByText('Across events')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'fetch_page'})).toBeInTheDocument();
  });

  it('calls out the step most recent events failed in', async () => {
    mockRecentEvents([
      {id: 's1', 'gen_ai.tool.name': 'search_docs'},
      {id: 's2', 'gen_ai.tool.name': 'search_docs'},
      {id: 's3', 'gen_ai.tool.name': 'search_docs'},
      {id: 's4', 'gen_ai.tool.name': 'fetch_page'},
    ]);
    render(<AgentRunHighlights event={event} />, {organization});

    expect(await screen.findByText('Across events')).toBeInTheDocument();
    expect(screen.getByText(/in 3 of/)).toBeInTheDocument();
    expect(screen.getByText('4 recent events')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'fetch_page'})).not.toBeInTheDocument();
  });

  it('lists the steps when no single step dominates', async () => {
    mockRecentEvents([
      {id: 's1', 'gen_ai.tool.name': 'search_docs'},
      {id: 's2', 'gen_ai.tool.name': 'search_docs'},
      {id: 's3', 'gen_ai.tool.name': 'fetch_page'},
      {id: 's4', 'gen_ai.tool.name': 'fetch_page'},
    ]);
    render(<AgentRunHighlights event={event} />, {organization});

    expect(await screen.findByText('Across events')).toBeInTheDocument();
    expect(screen.getAllByRole('link', {name: 'search_docs'})).toHaveLength(2);
    expect(screen.getByRole('link', {name: 'fetch_page'})).toBeInTheDocument();
  });

  it('renders nothing without the feature flag', () => {
    const traceRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace/${traceId}/`,
      body: makeTrace(),
    });
    const {container} = render(<AgentRunHighlights event={event} />, {
      organization: OrganizationFixture({features: ['performance-view']}),
    });

    expect(container).toBeEmptyDOMElement();
    expect(traceRequest).not.toHaveBeenCalled();
  });
});
