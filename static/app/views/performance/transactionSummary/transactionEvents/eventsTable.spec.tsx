import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import EventsTable from 'sentry/views/performance/transactionSummary/transactionEvents/eventsTable';

type Data = {
  features?: string[];
};

export const MOCK_EVENTS_TABLE_DATA = [
  {
    id: 'deadbeef',
    'user.display': 'uhoh@example.com',
    'transaction.duration': 400,
    'project.id': 1,
    timestamp: '2020-05-21T15:31:18+00:00',
    trace: '1234',
    'span_ops_breakdown.relative': '',
    'spans.browser': 100,
    'spans.db': 30,
    'spans.http': 170,
    'spans.resource': 100,
    'spans.total.time': 400,
  },
  {
    id: 'moredeadbeef',
    'user.display': 'moreuhoh@example.com',
    'transaction.duration': 600,
    'project.id': 1,
    timestamp: '2020-05-22T15:31:18+00:00',
    trace: '4321',
    'span_ops_breakdown.relative': '',
    'spans.browser': 100,
    'spans.db': 300,
    'spans.http': 100,
    'spans.resource': 100,
    'spans.total.time': 600,
  },
];

export const EVENTS_TABLE_RESPONSE_FIELDS = [
  'id',
  'user.display',
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
  'transaction.duration',
  'trace',
  'timestamp',
  'spans.total.time',
  ...SPAN_OP_BREAKDOWN_FIELDS,
];

function initializeData({features: additionalFeatures = []}: Data = {}) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  const organization = TestStubs.Organization({
    features,
    projects: [TestStubs.Project()],
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: '/performance',
          project: 1,
          transactionCursor: '1:0:0',
        },
      },
    },
    projects: [],
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance GridEditable Table', function () {
  const transactionsListTitles = [
    t('event id'),
    t('user'),
    t('operation duration'),
    t('total duration'),
    t('trace id'),
    t('timestamp'),
  ];
  let fields = EVENTS_TABLE_RESPONSE_FIELDS;
  const organization = TestStubs.Organization();
  const transactionName = 'transactionName';
  let data;

  const query =
    'transaction.duration:<15m event.type:transaction transaction:/api/0/organizations/{organization_slug}/events/';

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
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
      {context: initialData.routerContext}
    );

    expect(await screen.findAllByTestId('relative-ops-breakdown')).toHaveLength(2);

    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.getByText('operation duration')).toBeInTheDocument();
    expect(screen.queryByTestId('grid-head-cell-static')).not.toBeInTheDocument();
  });

  it('renders basic columns without ops breakdown when not querying for span_ops_breakdown.relative', function () {
    const initialData = initializeData();

    fields = [
      'id',
      'user.display',
      'transaction.duration',
      'trace',
      'timestamp',
      'spans.http',
    ];

    data.forEach(result => {
      delete result['span_ops_breakdown.relative'];
      delete result['spans.resource'];
      delete result['spans.browser'];
      delete result['spans.db'];
      delete result['spans.total.time'];
    });

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

    const {container} = render(
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      {context: initialData.routerContext}
    );

    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.queryByText(SPAN_OP_RELATIVE_BREAKDOWN_FIELD)).not.toBeInTheDocument();
    expect(screen.queryByTestId('relative-ops-breakdown')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-head-cell-static')).not.toBeInTheDocument();
    expect(container).toSnapshot();
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
      {context: initialData.routerContext}
    );

    expect(await screen.findByRole('link', {name: 'deadbeef'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/undefined:deadbeef/?project=1&transaction=transactionName&transactionCursor=1%3A0%3A0'
    );

    expect(screen.getByRole('link', {name: '1234'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/trace/1234/?'
    );
  });

  it('renders replay id', async function () {
    const initialData = initializeData();

    fields = [...fields, 'replayId'];
    data.forEach(result => {
      result.replayId = 'mock_replay_id';
    });

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

    const {container} = render(
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      {context: initialData.routerContext}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(container).toSnapshot();
  });

  it('renders profile id', async function () {
    const initialData = initializeData();

    fields = [...fields, 'profile.id'];
    data.forEach(result => {
      result['profile.id'] = 'mock_profile_id';
    });

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

    const {container} = render(
      <EventsTable
        eventView={eventView}
        organization={organization}
        routes={initialData.router.routes}
        location={initialData.router.location}
        setError={() => {}}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />,
      {context: initialData.routerContext}
    );

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(container).toSnapshot();
  });
});
