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

import ClassifierDetail from './detail';

const RESULT_FIELD = 'tags[sentry.enrichment.user_frustration,number]';

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

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'frontend'})]);
    MockApiClient.addMockResponse({url: timeSeriesUrl, body: {timeSeries: []}});
    MockApiClient.addMockResponse({url: eventsUrl, body: {data: []}});
    MockApiClient.addMockResponse({url: prebuiltUrl, body: []});
  });

  it('renders the classifier name and dataset', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        name: 'Stuck in a loop',
        dataset: 'conversation',
        filterQuery: '(gen_ai.agent.name:planner) AND (conversation.messages:>10)',
      }),
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
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        filterQuery: '(gen_ai.agent.name:seer_chat OR gen_ai.function_id:seer_chat)',
      }),
    });

    renderDetail();

    expect(await screen.findByText('gen_ai.agent.name')).toBeInTheDocument();
    expect(screen.getByText('gen_ai.function_id')).toBeInTheDocument();
    expect(screen.getByText('Any of')).toBeInTheDocument();
  });

  it('shows the environment and agent selectors apart from the search', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        filterQuery:
          '(environment:["production"] (gen_ai.agent.name:["seer_chat"] OR gen_ai.function_id:["seer_chat"])) and (conversation.messages:>10)',
      }),
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
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        name: 'Frustration on checkout',
        prebuiltClassifierKey: 'user_frustration',
      }),
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

  it('shows the sidebar once the prebuilt classifier loads', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        name: 'Checkout frustration',
        prebuiltClassifierKey: 'user_frustration',
      }),
    });
    MockApiClient.addMockResponse({
      url: prebuiltUrl,
      asyncDelay: 50,
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

    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Details'})).not.toBeInTheDocument();
    expect(await screen.findByText('User frustration')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Details'})).toBeInTheDocument();
  });

  it('shows custom classifiers as custom', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', prebuiltClassifierKey: null}),
    });

    renderDetail();

    expect(await screen.findByText('Custom')).toBeInTheDocument();
  });

  it('hides the filters when the classifier has no search query', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', filterQuery: ''}),
    });

    renderDetail();

    expect(await screen.findByRole('heading', {name: 'Details'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Filters'})).not.toBeInTheDocument();
  });

  it('shows the number of classified conversations', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        projectId: '1',
        resultAttribute: 'user_frustration',
      }),
    });
    const countRequest = MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {data: [{'count_unique(gen_ai.conversation.id)': 1234}]},
      match: [
        MockApiClient.matchQuery({field: ['count_unique(gen_ai.conversation.id)']}),
      ],
    });

    renderDetail();

    expect(await screen.findByText('1.2K conversations classified')).toBeInTheDocument();
    expect(countRequest).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'enrichment_attributes',
          query: `has:${RESULT_FIELD}`,
          project: [1],
          statsPeriod: '24h',
        }),
      })
    );
  });

  it('scopes the results to the selected environment and time range', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        projectId: '1',
        resultAttribute: 'user_frustration',
      }),
    });
    const countRequest = MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {data: [{'count_unique(gen_ai.conversation.id)': 5}]},
      match: [
        MockApiClient.matchQuery({field: ['count_unique(gen_ai.conversation.id)']}),
      ],
    });
    const timeSeriesRequest = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {timeSeries: []},
    });
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend', environments: ['production']}),
    ]);

    renderDetail(organization, {environment: 'production', statsPeriod: '7d'});

    expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();
    await waitFor(() =>
      expect(countRequest).toHaveBeenCalledWith(
        eventsUrl,
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['production'],
            statsPeriod: '7d',
          }),
        })
      )
    );
    expect(timeSeriesRequest).toHaveBeenCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['production'],
          statsPeriod: '7d',
        }),
      })
    );
  });

  it('hides the environment filter when the classifier query sets one', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        projectId: '1',
        resultAttribute: 'user_frustration',
        filterQuery: 'environment:staging',
      }),
    });
    const countRequest = MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {data: [{'count_unique(gen_ai.conversation.id)': 5}]},
      match: [
        MockApiClient.matchQuery({field: ['count_unique(gen_ai.conversation.id)']}),
      ],
    });
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
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        projectId: '1',
        resultAttribute: 'user_frustration',
        outputType: 'binary',
      }),
    });
    const resultsRequest = MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {
        data: [
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
      },
      headers: {
        Link: '<https://example.com/next>; rel="next"; results="true"; cursor="0:20:0"',
      },
    });
    const conversationsRequest = MockApiClient.addMockResponse({
      url: conversationsUrl,
      body: [
        ConversationFixture('conv-1', 'First conversation'),
        ConversationFixture('conv-2', 'Second conversation'),
      ],
    });

    renderDetail();

    expect(await screen.findByText('Second conversation')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'sentry.enrichment.user_frustration'})
    ).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual(
      ['Conversation', 'sentry.enrichment.user_frustration', 'Age']
    );

    const [, secondRow, firstRow] = screen.getAllByRole('row');
    expect(within(secondRow!).getByText('Second conversation')).toBeInTheDocument();
    expect(within(secondRow!).getByText('90%')).toBeInTheDocument();
    expect(within(secondRow!).getByText('5m ago')).toBeInTheDocument();
    expect(within(firstRow!).getByText('First conversation')).toBeInTheDocument();
    expect(within(firstRow!).getByText('25%')).toBeInTheDocument();
    expect(within(firstRow!).getByText('10m ago')).toBeInTheDocument();

    expect(resultsRequest).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'enrichment_attributes',
          field: ['gen_ai.conversation.id', RESULT_FIELD, 'timestamp'],
          query: `has:${RESULT_FIELD}`,
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
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        projectId: '1',
        resultAttribute: 'user_frustration',
      }),
    });
    const resultsRequest = MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {
        data: [
          {
            'gen_ai.conversation.id': 'conv-1',
            [RESULT_FIELD]: 0.5,
            timestamp: minutesAgo(5),
          },
        ],
      },
      match: [
        MockApiClient.matchQuery({referrer: 'api.classifiers.detail.conversations'}),
      ],
    });
    MockApiClient.addMockResponse({
      url: conversationsUrl,
      body: [ConversationFixture('conv-1', 'First conversation')],
    });

    renderDetail();

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
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        projectId: '1',
        resultAttribute: 'user_frustration',
      }),
    });
    MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {data: [{'gen_ai.conversation.id': 'conv-1', [RESULT_FIELD]: 0.5}]},
    });
    MockApiClient.addMockResponse({
      url: conversationsUrl,
      body: [ConversationFixture('conv-1', 'First conversation')],
    });

    const {router} = renderDetail();

    await userEvent.click(await screen.findByText('First conversation'));

    expect(router.location.pathname).toContain('/conv-1/');
    expect(router.location.query.project).toBe('1');
  });

  it('charts the count of the classifier result attribute', async () => {
    const yAxis = 'count(tags[sentry.enrichment.user_frustration,number])';
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({
        id: '10',
        projectId: '1',
        resultAttribute: 'user_frustration',
      }),
    });
    const timeSeriesRequest = MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {timeSeries: [TimeSeriesFixture({yAxis})]},
    });

    renderDetail();

    expect(await screen.findByText('Instances')).toBeInTheDocument();
    expect(timeSeriesRequest).toHaveBeenCalledWith(
      timeSeriesUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'enrichment_attributes',
          yAxis,
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

  it('shows an empty state when the classifier has no instances', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', projectId: '1'}),
    });
    MockApiClient.addMockResponse({
      url: timeSeriesUrl,
      body: {
        timeSeries: [
          TimeSeriesFixture({
            values: [
              {value: 0, timestamp: 1729796400000},
              {value: 0, timestamp: 1729798200000},
            ],
          }),
        ],
      },
    });

    renderDetail();

    expect(await screen.findByText('No data to plot.')).toBeInTheDocument();
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
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'enabled'}),
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'disabled'}),
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
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'disabled'}),
    });
    const updateRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'enabled'}),
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
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'enabled'}),
    });

    renderDetail(
      OrganizationFixture({features: ['classifiers-ui'], access: ['org:read']})
    );

    expect(await screen.findByRole('button', {name: 'Disable'})).toBeEnabled();
  });

  it('disables the status toggle without project access', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: TelemetryClassifierFixture({id: '10', projectId: '1', status: 'enabled'}),
    });
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
});
