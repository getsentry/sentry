import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {AI_AGENTS_GETTING_STARTED_DOCS_LINK} from 'sentry/views/insights/pages/agents/utils/docsLinks';

import ConversationsOverviewPage from './overview';

const organization = OrganizationFixture({
  features: ['gen-ai-agents-overview', 'gen-ai-conversations'],
});

const organizationWithoutAgentsOverview = OrganizationFixture({
  features: ['gen-ai-conversations'],
});

const MISSING_AGENT_SPANS_MESSAGE =
  'You’re sending LLM calls only — no agent or tool spans yet. Running agents in your app?';
const AGENT_OR_TOOL_QUERY = '(gen_ai.operation.type:agent OR gen_ai.operation.type:tool)';
const LLM_QUERY = 'gen_ai.operation.type:ai_client';

describe('ConversationsOverviewPage', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', hasInsightsAgentMonitoring: true}),
    ]);
    localStorage.setItem(
      `conversations:projects-with-data:${organization.slug}`,
      JSON.stringify([-1])
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({referrer: Referrer.CHART})],
      body: {data: [{id: 'agent-span-id'}]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'count_unique(gen_ai.conversation.id)',
            meta: {valueType: 'number', valueUnit: null, interval: 1_800_000},
          }),
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {meta: {isMetricsData: false}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/traces/`,
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      body: {
        dataset: [],
        environment: [],
        field: [],
        orderby: [],
        projects: [],
        query: {error: null, fields: [], valid: true},
        valid: true,
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project-slug/keys/`,
      body: ProjectKeysFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdk-updates/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });
  });

  afterEach(() => {
    localStorage.clear();
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('shows the existing conversations overview when the agents overview is disabled', async () => {
    render(<ConversationsOverviewPage />, {
      organization: organizationWithoutAgentsOverview,
    });

    expect(
      await screen.findByRole('button', {name: 'Conversation Count'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Conversations'})).not.toBeInTheDocument();
    expect(screen.queryByText('Agent runs')).not.toBeInTheDocument();
    expect(screen.queryByText(MISSING_AGENT_SPANS_MESSAGE)).not.toBeInTheDocument();
  });

  it('shows conversation onboarding when the agents overview is disabled without conversation data', async () => {
    localStorage.clear();
    render(<ConversationsOverviewPage />, {
      organization: organizationWithoutAgentsOverview,
    });

    expect(await screen.findByRole('button', {name: 'Copy prompt'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Conversations'})).not.toBeInTheDocument();
    expect(screen.queryByText('Agent runs')).not.toBeInTheDocument();
  });

  it('defaults to conversations when conversation data is known', async () => {
    render(<ConversationsOverviewPage />, {organization});

    expect(await screen.findByRole('tab', {name: 'Conversations'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    const agentRunsChartTitle = await screen.findByText('Agent runs');
    const estimatedCostChartTitle = screen.getByText('Estimated Cost');
    expect(screen.getByText('Tool calls')).toBeInTheDocument();
    expect(
      estimatedCostChartTitle.compareDocumentPosition(agentRunsChartTitle) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const chartInterval = screen.getByRole('button', {name: /^Chart interval:/});
    const tabList = screen.getByRole('tablist');
    const tableSearch = screen.getByRole('combobox', {name: 'Add a search term'});
    expect(
      chartInterval.compareDocumentPosition(tabList) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      tabList.compareDocumentPosition(tableSearch) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('only shows the cost chart and setup banner without agent or tool spans', async () => {
    let finishAgentOrToolRequest!: () => void;
    const agentOrToolRequestGate = new Promise<void>(resolve => {
      finishAgentOrToolRequest = resolve;
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({referrer: Referrer.CHART, query: LLM_QUERY})],
      body: {data: [{id: 'llm-span-id'}]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          referrer: Referrer.CHART,
          query: AGENT_OR_TOOL_QUERY,
        }),
      ],
      body: {data: []},
      asyncDelay: agentOrToolRequestGate,
    });

    render(<ConversationsOverviewPage />, {organization});

    expect(
      await screen.findByRole('button', {name: /^Chart interval:/})
    ).toBeInTheDocument();
    expect(screen.queryByText('Agent runs')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimated Cost')).not.toBeInTheDocument();
    expect(screen.queryByText('Tool calls')).not.toBeInTheDocument();

    finishAgentOrToolRequest();

    const banner = await screen.findByText(MISSING_AGENT_SPANS_MESSAGE);
    const costChartTitle = screen.getByText('Estimated Cost');
    expect(screen.getByRole('button', {name: 'Set Up Agent Tracing'})).toHaveAttribute(
      'href',
      AI_AGENTS_GETTING_STARTED_DOCS_LINK
    );
    expect(screen.queryByText('Agent runs')).not.toBeInTheDocument();
    expect(screen.queryByText('Tool calls')).not.toBeInTheDocument();
    expect(
      banner.compareDocumentPosition(costChartTitle) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {name: 'Dismiss banner'})
    ).not.toBeInTheDocument();
  });

  it('does not show the banner when the selected time range has no LLM spans', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [MockApiClient.matchQuery({referrer: Referrer.CHART})],
      body: {data: []},
    });

    render(<ConversationsOverviewPage />, {organization});

    expect(await screen.findByText('Estimated Cost')).toBeInTheDocument();
    expect(screen.queryByText('Agent runs')).not.toBeInTheDocument();
    expect(screen.queryByText('Tool calls')).not.toBeInTheDocument();
    expect(screen.queryByText(MISSING_AGENT_SPANS_MESSAGE)).not.toBeInTheDocument();
  });

  it('does not apply the table search to agent charts', async () => {
    const chartRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      match: [MockApiClient.matchQuery({referrer: 'api.dashboards.widget.bar-chart'})],
      body: {data: []},
    });

    render(<ConversationsOverviewPage />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/agents/`,
          query: {query: 'span.op:http', statsPeriod: '13d'},
        },
      },
    });

    expect(await screen.findByText('Agent runs')).toBeInTheDocument();
    await waitFor(() => expect(chartRequest).toHaveBeenCalled());
    const chartQueries = chartRequest.mock.calls.map(([, options]) =>
      JSON.stringify(options.query)
    );
    expect(chartQueries.join(' ')).not.toContain('span.op:http');
  });

  it('changes the interval for all agent charts', async () => {
    const {router} = render(<ConversationsOverviewPage />, {organization});

    await userEvent.click(await screen.findByRole('button', {name: /^Chart interval:/}));
    await userEvent.click(screen.getByRole('option', {name: '3 hours'}));

    await waitFor(() => {
      expect(router.location.query.interval).toBe('3h');
    });
    expect(
      screen.getByRole('button', {name: 'Chart interval: 3 hours'})
    ).toBeInTheDocument();
  });

  it('defaults to traces and shows conversation onboarding on demand', async () => {
    localStorage.clear();
    render(<ConversationsOverviewPage />, {organization});

    expect(await screen.findByRole('tab', {name: 'Traces'})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await userEvent.click(screen.getByRole('tab', {name: 'Conversations'}));

    expect(screen.getByRole('tab', {name: 'Conversations'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.queryByRole('combobox', {name: 'Add a search term'})
    ).not.toBeInTheDocument();
    expect(screen.getByText('Agent runs')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Copy prompt'})).toBeInTheDocument();
  });

  it('shows conversation onboarding without data tabs when there are no gen AI spans', async () => {
    localStorage.clear();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', hasInsightsAgentMonitoring: false}),
    ]);

    render(<ConversationsOverviewPage />, {organization});

    expect(await screen.findByRole('button', {name: 'Copy prompt'})).toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Conversations'})).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'Traces'})).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', {name: 'LLM Calls'})).not.toBeInTheDocument();
    expect(screen.queryByText('Agent runs')).not.toBeInTheDocument();
  });

  it('shows agentic spans in the LLM Calls tab', async () => {
    localStorage.clear();
    render(<ConversationsOverviewPage />, {organization});

    await userEvent.click(await screen.findByRole('tab', {name: 'LLM Calls'}));

    expect(
      await screen.findByRole('tab', {name: 'LLM Calls', selected: true})
    ).toBeInTheDocument();
    expect(await screen.findByTestId('spans-table')).toBeInTheDocument();
  });

  it('keeps the missing messages alert visible across tabs', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [
        {
          conversationId: 'conversation-id',
          duration: 1000,
          endTimestamp: 2000,
          errors: 0,
          firstInput: null,
          lastOutput: null,
          llmCalls: 1,
          startTimestamp: 1000,
          toolCalls: 0,
          toolErrors: 0,
          toolNames: [],
          totalCost: null,
          totalTokens: 100,
          traceCount: 1,
          traceIds: ['trace-id'],
          user: null,
        },
      ],
    });
    render(<ConversationsOverviewPage />, {organization});

    expect(
      await screen.findByRole('heading', {name: 'Capture Your Conversation Messages'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Traces'}));
    expect(
      screen.getByRole('heading', {name: 'Capture Your Conversation Messages'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'LLM Calls'}));
    expect(
      screen.getByRole('heading', {name: 'Capture Your Conversation Messages'})
    ).toBeInTheDocument();
  });

  it('does not load recent searches for conversations', async () => {
    const recentSearchRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [{query: 'span.op:http'}],
    });
    render(<ConversationsOverviewPage />, {organization});

    await userEvent.click(
      await screen.findByRole('combobox', {name: 'Add a search term'})
    );

    expect(recentSearchRequest).not.toHaveBeenCalled();
    expect(screen.queryByTestId('recent-filter-key')).not.toBeInTheDocument();
  });

  it('sorts conversation aliases above matching span attributes', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [
        {key: 'ai.toolCall.args', name: 'ai.toolCall.args', attributeType: 'string'},
        {key: 'ai.toolCall.result', name: 'ai.toolCall.result', attributeType: 'string'},
        {
          key: 'ai.response.toolCalls',
          name: 'ai.response.toolCalls',
          attributeType: 'string',
        },
      ],
    });

    render(<ConversationsOverviewPage />, {organization});

    await userEvent.click(
      await screen.findByRole('combobox', {name: 'Add a search term'})
    );
    await userEvent.keyboard('toolca');

    await screen.findByRole('option', {name: 'conversation.toolCalls'});

    // Options render the key followed by its value type, e.g. "conversation.toolCallsinteger".
    const matchedKeys = screen
      .getAllByRole('option')
      .map(option => option.textContent ?? '')
      .filter(text => text.includes('toolCall') || text.includes('toolErrors'));

    // Both table-header aliases win over the raw span attributes, even though
    // `ai.toolCall.args` matches the input more literally.
    expect(matchedKeys[0]).toMatch(/^conversation\.toolCalls/);
    expect(matchedKeys[1]).toMatch(/^conversation\.toolErrors/);
  });

  it('offers conversation aggregate aliases as filters', async () => {
    render(<ConversationsOverviewPage />, {organization});

    await userEvent.click(
      await screen.findByRole('combobox', {name: 'Add a search term'})
    );

    const aliases = [
      'conversation.age',
      'conversation.duration',
      'conversation.generationDuration',
      'conversation.errors',
      'conversation.messages',
      'conversation.toolCalls',
      'conversation.totalTokens',
      'conversation.inputTokens',
      'conversation.outputTokens',
      'conversation.totalCost',
      'conversation.toolErrors',
    ];
    const options = await screen.findAllByRole('option');

    aliases.forEach((alias, index) => {
      expect(options[index]).toHaveAccessibleName(alias);
    });

    await userEvent.keyboard('{ArrowDown}');
    expect(
      await screen.findByText("Time of the conversation's latest span.")
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('option', {name: 'conversation.generationDuration'})
    );
    expect(
      await screen.findByRole('row', {
        name: 'conversation.generationDuration:>10ms',
      })
    ).toBeInTheDocument();
  });
});
