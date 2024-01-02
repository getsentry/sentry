import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {WebVital} from 'sentry/utils/fields';
import TransactionEvents from 'sentry/views/performance/transactionSummary/transactionEvents';

// XXX(epurkhiser): This appears to also be tested by ./transactionSummary/transactionEvents/index.spec.tsx

type Data = {
  features?: string[];
  query?: {
    webVital?: WebVital;
  };
};

function initializeData({features: additionalFeatures = [], query = {}}: Data = {}) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  const organization = Organization({
    features,
    projects: [ProjectFixture()],
  });
  return initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: '/performance',
          project: '1',
          transactionCursor: '1:0:0',
          ...query,
        },
      },
    },
    projects: [],
  });
}

describe('Performance > TransactionSummary', function () {
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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'p100()': 9502,
            'p99()': 9285.7,
            'p95()': 7273.6,
            'p75()': 3639.5,
            'p50()': 755.5,
          },
        ],
        meta: {
          fields: {
            'p100()': 'duration',
            'p99()': 'duration',
            'p95()': 'duration',
            'p75()': 'duration',
            'p50()': 'duration',
          },
        },
      },
      match: [
        (_, options) => {
          return options.query?.field?.includes('p95()');
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
        data: [
          {
            id: 'deadbeef',
            'user.display': 'uhoh@example.com',
            'transaction.duration': 400,
            'project.id': 1,
            timestamp: '2020-05-21T15:31:18+00:00',
            trace: '1234',
            'measurements.lcp': 200,
          },
          {
            id: 'moredeadbeef',
            'user.display': 'moreuhoh@example.com',
            'transaction.duration': 600,
            'project.id': 1,
            timestamp: '2020-05-22T15:31:18+00:00',
            trace: '4321',
            'measurements.lcp': 300,
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('user.display');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{'count()': 5161}],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('count()');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function () {
    const {organization, router, routerContext} = initializeData();

    ProjectsStore.loadInitialData(organization.projects);

    render(<TransactionEvents organization={organization} location={router.location} />, {
      context: routerContext,
    });

    // Breadcrumb
    expect(screen.getByRole('link', {name: 'Performance'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/?project=1&transactionCursor=1%3A0%3A0'
    );

    // Header
    expect(screen.getByRole('heading', {name: '/performance'})).toBeInTheDocument();

    expect(
      await screen.findByRole('textbox', {name: 'Search events'})
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();

    expect(screen.getByRole('table')).toBeInTheDocument();

    expect(screen.getByRole('tab', {name: 'Overview'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Sampled Events'})).toBeInTheDocument();
    expect(screen.getByRole('tab', {name: 'Tags'})).toBeInTheDocument();

    ProjectsStore.reset();
  });

  it('renders relative span breakdown header when no filter selected', async function () {
    const {organization, router, routerContext} = initializeData();

    ProjectsStore.loadInitialData(organization.projects);

    render(<TransactionEvents organization={organization} location={router.location} />, {
      context: routerContext,
    });

    expect(await screen.findByText('operation duration')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);

    ProjectsStore.reset();
  });

  it('renders event column results correctly', async function () {
    const {organization, router, routerContext} = initializeData();

    ProjectsStore.loadInitialData(organization.projects);

    render(<TransactionEvents organization={organization} location={router.location} />, {
      context: routerContext,
    });

    const tableHeader = await screen.findAllByRole('columnheader');
    expect(tableHeader).toHaveLength(6);
    expect(tableHeader[0]).toHaveTextContent('event id');
    expect(tableHeader[1]).toHaveTextContent('user');
    expect(tableHeader[2]).toHaveTextContent('operation duration');
    expect(tableHeader[3]).toHaveTextContent('total duration');
    expect(tableHeader[4]).toHaveTextContent('trace id');
    expect(tableHeader[5]).toHaveTextContent('timestamp');

    const tableFirstRowColumns = screen.getAllByRole('cell');
    expect(tableFirstRowColumns[0]).toHaveTextContent('deadbeef');
    expect(tableFirstRowColumns[1]).toHaveTextContent('Uuhoh@example.com');
    expect(tableFirstRowColumns[2]).toHaveTextContent('(no value)');
    expect(tableFirstRowColumns[3]).toHaveTextContent('400.00ms');
    expect(tableFirstRowColumns[4]).toHaveTextContent('1234');
    expect(tableFirstRowColumns[5]).toHaveTextContent('May 21, 2020 3:31:18 PM UTC');

    ProjectsStore.reset();
  });

  it('renders additional Web Vital column', async function () {
    const {organization, router, routerContext} = initializeData({
      query: {webVital: WebVital.LCP},
    });

    ProjectsStore.loadInitialData(organization.projects);

    render(<TransactionEvents organization={organization} location={router.location} />, {
      context: routerContext,
    });

    const tableHeader = await screen.findAllByRole('columnheader');
    expect(tableHeader).toHaveLength(7);
    expect(tableHeader[0]).toHaveTextContent('event id');
    expect(tableHeader[1]).toHaveTextContent('user');
    expect(tableHeader[2]).toHaveTextContent('operation duration');
    expect(tableHeader[3]).toHaveTextContent('measurements.lcp');
    expect(tableHeader[4]).toHaveTextContent('total duration');
    expect(tableHeader[5]).toHaveTextContent('trace id');
    expect(tableHeader[6]).toHaveTextContent('timestamp');

    const tableFirstRowColumns = screen.getAllByRole('cell');
    expect(tableFirstRowColumns[0]).toHaveTextContent('deadbeef');
    expect(tableFirstRowColumns[1]).toHaveTextContent('Uuhoh@example.com');
    expect(tableFirstRowColumns[2]).toHaveTextContent('(no value)');
    expect(tableFirstRowColumns[3]).toHaveTextContent('200');
    expect(tableFirstRowColumns[4]).toHaveTextContent('400.00ms');
    expect(tableFirstRowColumns[5]).toHaveTextContent('1234');
    expect(tableFirstRowColumns[6]).toHaveTextContent('May 21, 2020 3:31:18 PM UTC');

    ProjectsStore.reset();
  });
});
