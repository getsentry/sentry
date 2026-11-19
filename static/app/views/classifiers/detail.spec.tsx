import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';

import {Referrer} from './constants';
import ClassifierDetail from './detail';
import type {TelemetryClassifier} from './types';

const RESULT_FIELD = 'tags[sentry.enrichment.user_frustration,number]';
const COUNT_FIELDS = ['count_unique(gen_ai.conversation.id)', 'count_unique(user)'];

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function ConversationFixture(conversationId: string, title: string) {
  return {
    conversationId,
    endTimestamp: 2000,
    errors: 0,
    firstInput: null,
    generationDuration: 5000,
    inputTokens: 10,
    lastOutput: null,
    llmCalls: 3,
    outputTokens: 20,
    projectId: 1,
    startTimestamp: 1000,
    timeSpan: 1000,
    title,
    toolCalls: 0,
    toolErrors: 0,
    toolNames: [],
    totalCost: null,
    totalTokens: 100,
    traceCount: 1,
    traceIds: ['trace-1'],
    user: null,
  };
}

const DISABLED_MESSAGE =
  'This classifier is disabled and is not classifying new conversations.';

describe('ClassifierDetail', () => {
  const organization = OrganizationFixture({features: ['classifiers-ui']});
  const detailUrl = `/organizations/${organization.slug}/classifiers/10/`;
  const timeSeriesUrl = `/organizations/${organization.slug}/events-timeseries/`;
  const eventsUrl = `/organizations/${organization.slug}/events/`;
  const conversationsUrl = `/organizations/${organization.slug}/agents/conversations/`;
  const prebuiltUrl = `/organizations/${organization.slug}/classifiers/prebuilt/`;

  function renderDetail(
    org: Organization = organization,
    query: Record<string, string> = {}
  ) {
    return render(<ClassifierDetail />, {
      organization: org,
      initialRouterConfig: {
        location: {pathname: `/organizations/${org.slug}/seer/classifiers/10/`, query},
        route: '/organizations/:orgId/seer/classifiers/:classifierId/',
      },
    });
  }

  function mockClassifier(params: Partial<TelemetryClassifier> = {}) {
    return MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', ...params}),
    });
  }

  function mockCounts(counts: Record<string, number>) {
    return MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {data: [counts]},
      match: [MockApiClient.matchQuery({field: COUNT_FIELDS})],
    });
  }

  function mockResults(
    data: Array<Record<string, unknown>>,
    headers?: Record<string, string>
  ) {
    return MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {data},
      headers,
      match: [MockApiClient.matchQuery({referrer: Referrer.DETAIL_CONVERSATIONS})],
    });
  }

  function mockConversations(...conversations: Array<[id: string, title: string]>) {
    return MockApiClient.addMockResponse({
      url: conversationsUrl,
      body: conversations.map(([id, title]) => ConversationFixture(id, title)),
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'frontend'})]);
    MockApiClient.addMockResponse({url: timeSeriesUrl, body: {timeSeries: []}});
    MockApiClient.addMockResponse({url: eventsUrl, body: {data: []}});
    MockApiClient.addMockResponse({url: prebuiltUrl, body: []});
  });

  it('renders the classifier name and dataset', async () => {
    mockClassifier({
      name: 'Stuck in a loop',
      dataset: 'conversation',
      filterQuery: '(gen_ai.agent.name:planner) AND (conversation.messages:>10)',
    });

    renderDetail();

    expect(await screen.findByText('Stuck in a loop')).toBeInTheDocument();
    expect(await screen.findByRole('heading', {name: 'Details'})).toBeInTheDocument();
    expect(screen.getByText('Dataset')).toBeInTheDocument();
    expect(screen.getByText('Conversations')).toBeInTheDocument();
    expect(screen.getByText('Result attribute')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Filters'})).toBeInTheDocument();
    expect(screen.getByText('gen_ai.agent.name')).toBeInTheDocument();
    expect(screen.getByText('conversation.messages')).toBeInTheDocument();
    expect(screen.queryByText('AND')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {name: 'No results found'})
    ).toBeInTheDocument();
  });

  it('groups filters joined by OR', async () => {
    mockClassifier({
      filterQuery: '(gen_ai.agent.name:seer_chat OR gen_ai.function_id:seer_chat)',
    });

    renderDetail();

    expect(await screen.findByText('gen_ai.agent.name')).toBeInTheDocument();
    expect(screen.getByText('gen_ai.function_id')).toBeInTheDocument();
    expect(screen.getByText('Any of')).toBeInTheDocument();
  });

  it('shows the environment and agent selectors apart from the search', async () => {
    mockClassifier({
      filterQuery:
        '(environment:["production"] (gen_ai.agent.name:["seer_chat"] OR gen_ai.function_id:["seer_chat"])) and (conversation.messages:>10)',
    });

    renderDetail();

    expect(await screen.findByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('seer_chat')).toBeInTheDocument();
    expect(screen.getByText('conversation.messages')).toBeInTheDocument();
    expect(screen.queryByText('gen_ai.agent.name')).not.toBeInTheDocument();
  });

  it('shows the prebuilt classifier as the type', async () => {
    mockClassifier({
      name: 'Frustration on checkout',
      prebuiltClassifierKey: 'user_frustration',
    });
    MockApiClient.addMockResponse({
      url: prebuiltUrl,
      body: [
        {
          key: 'user_frustration',
          name: 'User frustration',
          dataset: 'conversation',
          description: '',
          resultAttribute: 'user_frustration',
        },
      ],
    });

    renderDetail();

    expect(await screen.findByText('User frustration')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('shows custom classifiers as custom', async () => {
    mockClassifier({prebuiltClassifierKey: null});

    renderDetail();

    expect(await screen.findByText('Custom')).toBeInTheDocument();
  });

  it('hides the filters when the classifier has no search query', async () => {
    mockClassifier({filterQuery: ''});

    renderDetail();

    expect(await screen.findByRole('heading', {name: 'Details'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Filters'})).not.toBeInTheDocument();
  });

  it('shows the number of classified conversations and affected users', async () => {
    mockClassifier();
    const countRequest = mockCounts({
      'count_unique(gen_ai.conversation.id)': 1234,
      'count_unique(user)': 56,
    });

    renderDetail();

    expect(await screen.findByText('1.2K conversations')).toBeInTheDocument();
    expect(screen.getByText('56 users')).toBeInTheDocument();
    expect(countRequest).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'enrichment_attributes',
          query: `${RESULT_FIELD}:>=0.8`,
          project: [1],
          statsPeriod: '24h',
        }),
      })
    );
  });

  it('resets the table cursor when the time range changes', async () => {
    mockClassifier();

    const {router} = renderDetail(organization, {tableCursor: '0:20:0'});

    await userEvent.click(
      await screen.findByRole('button', {name: '24H', expanded: false})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Last 7 days'}));

    await waitFor(() => expect(router.location.query.statsPeriod).toBe('7d'));
    expect(router.location.query.tableCursor).toBeUndefined();
  });

  it('scopes the results to the selected environment and time range', async () => {
    mockClassifier();
    const countRequest = mockCounts({'count_unique(gen_ai.conversation.id)': 5});
    const timeSeriesRequest = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {timeSeries: []},
    });
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend', environments: ['production']}),
    ]);

    renderDetail(organization, {environment: 'production', statsPeriod: '7d'});

    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();
    const scopedQuery = expect.objectContaining({
      query: expect.objectContaining({environment: ['production'], statsPeriod: '7d'}),
    });
    await waitFor(() =>
      expect(countRequest).toHaveBeenCalledWith(eventsUrl, scopedQuery)
    );
    expect(timeSeriesRequest).toHaveBeenCalledWith(timeSeriesUrl, scopedQuery);
  });

  it('hides the environment filter when the classifier query sets one', async () => {
    mockClassifier({filterQuery: 'environment:staging'});
    const countRequest = mockCounts({'count_unique(gen_ai.conversation.id)': 5});
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend', environments: ['production']}),
    ]);

    renderDetail(organization, {environment: 'production'});

    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'production'})).not.toBeInTheDocument();
    await waitFor(() =>
      expect(countRequest).toHaveBeenCalledWith(
        eventsUrl,
        expect.objectContaining({
          query: expect.objectContaining({environment: []}),
        })
      )
    );
  });

  it('lists the classified conversations with their result', async () => {
    mockClassifier();
    const resultsRequest = mockResults(
      [
        {
          'gen_ai.conversation.id': 'conv-2',
          [RESULT_FIELD]: 0.9,
          timestamp: minutesAgo(5),
        },
        {
          'gen_ai.conversation.id': 'conv-1',
          [RESULT_FIELD]: 0.25,
          timestamp: minutesAgo(10),
        },
        {
          'gen_ai.conversation.id': 'conv-2',
          [RESULT_FIELD]: 0.1,
          timestamp: minutesAgo(15),
        },
      ],
      {Link: '<https://example.com/next>; rel="next"; results="true"; cursor="0:20:0"'}
    );
    const conversationsRequest = mockConversations(
      ['conv-1', 'First conversation'],
      ['conv-2', 'Second conversation']
    );

    renderDetail();

    expect(await screen.findByText('Second conversation')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(
      ['Conversation', 'Age']
    );

    const [, secondRow, firstRow] = screen.getAllByRole('row');
    expect(within(secondRow!).getByText('Second conversation')).toBeInTheDocument();
    expect(within(secondRow!).getByText('5m ago')).toBeInTheDocument();
    expect(within(firstRow!).getByText('First conversation')).toBeInTheDocument();
    expect(within(firstRow!).getByText('10m ago')).toBeInTheDocument();

    expect(resultsRequest).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'enrichment_attributes',
          field: ['gen_ai.conversation.id', RESULT_FIELD, 'timestamp'],
          query: `${RESULT_FIELD}:>=0.8`,
          sort: '-timestamp',
          per_page: 20,
          project: [1],
          statsPeriod: '24h',
        }),
      })
    );
    expect(conversationsRequest).toHaveBeenCalledWith(
      conversationsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'gen_ai.conversation.id:[conv-2,conv-1]',
          per_page: 2,
          project: [1],
          statsPeriod: '24h',
        }),
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(resultsRequest).toHaveBeenLastCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({cursor: '0:20:0'}),
      })
    );
  });

  it('sorts the classified conversations by result and age', async () => {
    mockClassifier();
    const resultsRequest = mockResults([
      {'gen_ai.conversation.id': 'conv-1', [RESULT_FIELD]: 0.5, timestamp: minutesAgo(5)},
    ]);
    mockConversations(['conv-1', 'First conversation']);

    renderDetail(organization, {results: 'all'});

    await screen.findByText('First conversation');
    expect(screen.getByRole('columnheader', {name: 'Age'})).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    expect(screen.queryByRole('button', {name: 'Conversation'})).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', {name: 'sentry.enrichment.user_frustration'})
    );

    await waitFor(() =>
      expect(resultsRequest).toHaveBeenLastCalledWith(
        eventsUrl,
        expect.objectContaining({
          query: expect.objectContaining({sort: `-${RESULT_FIELD}`}),
        })
      )
    );
    expect(
      await screen.findByRole('columnheader', {
        name: 'sentry.enrichment.user_frustration',
      })
    ).toHaveAttribute('aria-sort', 'descending');

    await userEvent.click(
      screen.getByRole('button', {name: 'sentry.enrichment.user_frustration'})
    );

    await waitFor(() =>
      expect(resultsRequest).toHaveBeenLastCalledWith(
        eventsUrl,
        expect.objectContaining({
          query: expect.objectContaining({sort: RESULT_FIELD}),
        })
      )
    );

    await userEvent.click(screen.getByRole('button', {name: 'Age'}));
    expect(await screen.findByRole('columnheader', {name: 'Age'})).toHaveAttribute(
      'aria-sort',
      'descending'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Age'}));

    await waitFor(() =>
      expect(resultsRequest).toHaveBeenLastCalledWith(
        eventsUrl,
        expect.objectContaining({
          query: expect.objectContaining({sort: 'timestamp'}),
        })
      )
    );
  });

  it("opens a classified conversation in the classifier's project", async () => {
    mockClassifier();
    mockResults([{'gen_ai.conversation.id': 'conv-1', [RESULT_FIELD]: 0.5}]);
    mockConversations(['conv-1', 'First conversation']);

    const {router} = renderDetail();

    await userEvent.click(await screen.findByText('First conversation'));

    expect(router.location.pathname).toContain('/conv-1/');
    expect(router.location.query.project).toBe('1');
  });

  it('charts the classifier instances at the selected interval', async () => {
    mockClassifier();
    const timeSeriesRequest = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {timeSeries: [TimeSeriesFixture({yAxis: `count(${RESULT_FIELD})`})]},
    });

    renderDetail();

    expect(await screen.findByText('Instances')).toBeInTheDocument();
    expect(timeSeriesRequest).toHaveBeenCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          project: [1],
          statsPeriod: '24h',
          interval: '30m',
        }),
      })
    );

    await userEvent.click(screen.getByRole('button', {name: '30 minutes'}));
    await userEvent.click(screen.getByRole('option', {name: '10 minutes'}));

    expect(timeSeriesRequest).toHaveBeenLastCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({interval: '10m'}),
      })
    );
  });

  it('filters the results to non-matches', async () => {
    mockClassifier();
    const resultsRequest = mockResults([]);
    const countRequest = mockCounts({'count_unique(gen_ai.conversation.id)': 3});
    const timeSeriesRequest = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {timeSeries: []},
    });

    const {router} = renderDetail(organization, {tableCursor: '0:20:0'});

    await userEvent.click(await screen.findByRole('button', {name: 'Show matches'}));
    await userEvent.click(screen.getByRole('option', {name: 'Show non-matches'}));

    expect(await screen.findByText('3 conversations')).toBeInTheDocument();
    expect(router.location.query.results).toBe('non-matches');
    expect(router.location.query.tableCursor).toBeUndefined();
    const nonMatchQuery = expect.objectContaining({
      query: expect.objectContaining({query: `${RESULT_FIELD}:<0.8`}),
    });
    expect(resultsRequest).toHaveBeenLastCalledWith(eventsUrl, nonMatchQuery);
    expect(countRequest).toHaveBeenLastCalledWith(eventsUrl, nonMatchQuery);
    expect(timeSeriesRequest).toHaveBeenLastCalledWith(timeSeriesUrl, nonMatchQuery);
  });

  it('shows every result without a filter for non-binary classifiers', async () => {
    mockClassifier({outputType: null, binaryThreshold: null});
    mockResults([
      {
        'gen_ai.conversation.id': 'conv-1',
        [RESULT_FIELD]: 0.42,
        timestamp: minutesAgo(5),
      },
    ]);
    mockConversations(['conv-1', 'First conversation']);

    renderDetail(organization, {results: 'non-matches'});

    expect(await screen.findByText('First conversation')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(
      ['Conversation', 'sentry.enrichment.user_frustration', 'Age']
    );
    expect(
      screen.queryByRole('button', {name: 'Show non-matches'})
    ).not.toBeInTheDocument();
  });

  it('shows a not found message when the classifier does not exist', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      statusCode: 404,
      body: {detail: 'Not found'},
    });

    renderDetail();

    expect(
      await screen.findByText('The classifier could not be found.')
    ).toBeInTheDocument();
  });

  it('disables the classifier after confirming', async () => {
    mockClassifier({status: 'enabled'});
    const updateRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: TelemetryClassifierFixture({id: '10', status: 'disabled'}),
    });

    renderDetail();
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Disable'}));
    const modal = await screen.findByRole('dialog');
    expect(
      within(modal).getByText(
        'Are you sure you want to disable this classifier? New conversations will no longer be classified.'
      )
    ).toBeInTheDocument();
    expect(updateRequest).not.toHaveBeenCalled();

    await userEvent.click(within(modal).getByRole('button', {name: 'Disable'}));

    expect(updateRequest).toHaveBeenCalledWith(
      detailUrl,
      expect.objectContaining({data: {status: 'disabled'}})
    );
    expect(await screen.findByText(DISABLED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Enable'})).toBeInTheDocument();
  });

  it('enables a disabled classifier', async () => {
    mockClassifier({status: 'disabled'});
    const updateRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: TelemetryClassifierFixture({id: '10', status: 'enabled'}),
    });

    renderDetail();

    expect(await screen.findByText(DISABLED_MESSAGE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Enable'}));

    expect(updateRequest).toHaveBeenCalledWith(
      detailUrl,
      expect.objectContaining({data: {status: 'enabled'}})
    );
    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();
    expect(screen.queryByText(DISABLED_MESSAGE)).not.toBeInTheDocument();
  });

  it('lets members with project access change the status', async () => {
    mockClassifier({status: 'enabled'});

    renderDetail(
      OrganizationFixture({features: ['classifiers-ui'], access: ['org:read']})
    );

    expect(await screen.findByRole('button', {name: 'Disable'})).toBeEnabled();
  });

  it('disables the status toggle without project access', async () => {
    mockClassifier({status: 'enabled'});
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend', access: []}),
    ]);

    renderDetail(
      OrganizationFixture({features: ['classifiers-ui'], access: ['org:read']})
    );

    expect(await screen.findByRole('button', {name: 'Disable'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('deletes the classifier after confirming', async () => {
    mockClassifier();
    const deleteRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'DELETE',
    });

    const {router} = renderDetail();
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Delete'}));
    const modal = await screen.findByRole('dialog');
    expect(
      within(modal).getByText(
        'Are you sure you want to delete this classifier? This action cannot be undone.'
      )
    ).toBeInTheDocument();
    expect(deleteRequest).not.toHaveBeenCalled();

    await userEvent.click(within(modal).getByRole('button', {name: 'Delete'}));

    expect(deleteRequest).toHaveBeenCalledWith(
      detailUrl,
      expect.objectContaining({method: 'DELETE'})
    );
    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/seer/classifiers/`
      )
    );
  });

  it('does not delete the classifier when cancelling', async () => {
    mockClassifier();
    const deleteRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'DELETE',
    });

    renderDetail();
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Delete'}));
    const modal = await screen.findByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', {name: 'Cancel'}));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleteRequest).not.toHaveBeenCalled();
  });

  it('disables the delete button without project access', async () => {
    mockClassifier();
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend', access: []}),
    ]);

    renderDetail(
      OrganizationFixture({features: ['classifiers-ui'], access: ['org:read']})
    );

    expect(await screen.findByRole('button', {name: 'Delete'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
