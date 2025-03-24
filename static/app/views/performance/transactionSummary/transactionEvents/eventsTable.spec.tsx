import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {SPAN_OP_RELATIVE_BREAKDOWN_FIELD} from 'sentry/utils/discover/fields';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';
import {
  EVENTS_TABLE_RESPONSE_FIELDS,
  MOCK_EVENTS_TABLE_DATA,
} from 'sentry/views/performance/transactionSummary/transactionEvents/testUtils';

type Data = {
  features?: string[];
};

function initializeData({features: additionalFeatures = []}: Data = {}) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  const organization = OrganizationFixture({
    features,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: '/performance',
          project: '1',
          transactionCursor: '1:0:0',
        },
      },
    },
    projects: [],
  });
  ProjectsStore.loadInitialData(initialData.projects);
  return initialData;
}

describe('Performance GridEditable Table', function () {
  const transactionsListTitles = [
    'event id',
    'user',
    'operation duration',
    'total duration',
    'trace id',
    'timestamp',
  ];
  let fields = EVENTS_TABLE_RESPONSE_FIELDS;
  const organization = OrganizationFixture();
  const transactionName = 'transactionName';
  let data: typeof MOCK_EVENTS_TABLE_DATA;

  const query =
    'transaction.duration:<15m event.type:transaction transaction:/api/0/organizations/{organization_slug}/events/';

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });

    fields = EVENTS_TABLE_RESPONSE_FIELDS;
    data = MOCK_EVENTS_TABLE_DATA;

    // Total events count response
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          '<http://localhost/api/0/organizations/org-slug/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",' +
          '<http://localhost/api/0/organizations/org-slug/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"',
      },
      body: {
        meta: {
          fields: {
            'count()': 'integer',
          },
        },
        data: [{'count()': 100}],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('count()');
        },
      ],
    });

    // Transaction list response
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          '<http://localhost/api/0/organizations/org-slug/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",' +
          '<http://localhost/api/0/organizations/org-slug/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"',
      },
      body: {
        meta: {
          fields: {
            id: 'string',
            'user.display': 'string',
            'transaction.duration': 'duration',
            'project.id': 'integer',
            timestamp: 'date',
          },
        },
        data,
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('user.display');
        },
      ],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.clearAllMocks();
  });

  it('renders ops breakdown bar when querying for span_ops_breakdown.relative', async function () {
    const initialData = initializeData();

    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [],
        orderby: '-timestamp',
      },
      initialData.router.location
    );

    render(
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      {router: initialData.router}
    );

    expect(await screen.findAllByTestId('relative-ops-breakdown')).toHaveLength(2);

    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.getByText('operation duration')).toBeInTheDocument();
    expect(screen.queryByTestId('grid-head-cell-static')).not.toBeInTheDocument();
  });

  it('renders basic columns without ops breakdown when not querying for span_ops_breakdown.relative', async function () {
    const initialData = initializeData();

    fields = [
      'id',
      'user.display',
      'transaction.duration',
      'trace',
      'timestamp',
      'spans.http',
    ];

    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [],
        orderby: '-timestamp',
      },
      initialData.router.location
    );

    render(
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      {router: initialData.router}
    );

    expect(await screen.findAllByRole('columnheader')).toHaveLength(6);
    expect(screen.queryByText(SPAN_OP_RELATIVE_BREAKDOWN_FIELD)).not.toBeInTheDocument();
    expect(screen.queryByTestId('relative-ops-breakdown')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-head-cell-static')).not.toBeInTheDocument();
  });

  it('renders event id and trace id url', async function () {
    const initialData = initializeData();
    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [],
        orderby: '-timestamp',
      },
      initialData.router.location
    );

    render(
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      {router: initialData.router}
    );

    expect(await screen.findByRole('link', {name: 'deadbeef'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/undefined:deadbeef/?project=1&tab=events&transaction=transactionName&transactionCursor=1%3A0%3A0'
    );

    expect(screen.getByRole('link', {name: '1234'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/traces/trace/1234/?project=1&tab=events&transaction=%2Fperformance&transactionCursor=1%3A0%3A0'
    );
  });

  it('renders replay id', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });

    const initialData = initializeData();

    fields = [...fields, 'replayId'];

    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [],
        orderby: '-timestamp',
      },
      initialData.router.location
    );

    render(
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      {router: initialData.router}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });

  it('renders profile id', async function () {
    const initialData = initializeData();

    fields = [...fields, 'profile.id'];

    const eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [],
        orderby: '-timestamp',
      },
      initialData.router.location
    );

    render(
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      {router: initialData.router}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
  });
});
