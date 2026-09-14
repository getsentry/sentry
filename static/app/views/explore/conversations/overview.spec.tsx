import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';

import ConversationsOverviewPage from './overview';

const organization = OrganizationFixture({
  features: ['gen-ai-conversations', 'gen-ai-conversations-querying-enhancements'],
});

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
  });

  afterEach(() => {
    localStorage.clear();
    ProjectsStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('defaults to conversations when conversation data is known', async () => {
    render(<ConversationsOverviewPage />, {organization});

    expect(await screen.findByRole('tab', {name: 'Conversations'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('Agent runs')).toBeInTheDocument();
    expect(screen.getByText('Estimated Cost')).toBeInTheDocument();
    expect(screen.getByText('Tool calls')).toBeInTheDocument();
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
  });

  it('shows agentic spans in the Spans tab', async () => {
    localStorage.clear();
    render(<ConversationsOverviewPage />, {organization});

    await userEvent.click(await screen.findByRole('tab', {name: 'Spans'}));

    expect(
      await screen.findByRole('tab', {name: 'Spans', selected: true})
    ).toBeInTheDocument();
    expect(await screen.findByTestId('spans-table')).toBeInTheDocument();
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
