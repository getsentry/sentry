import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import {WebVital} from 'sentry/utils/fields';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import EventsPageContent from 'sentry/views/performance/transactionSummary/transactionEvents/content';
import {EventsDisplayFilterName} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';

function initializeData() {
  const organization = Organization({
    features: ['discover-basic', 'performance-view'],
    projects: [ProjectFixture()],
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
  act(() => void ProjectsStore.loadInitialData(initialData.organization.projects));
  return initialData;
}

describe('Performance Transaction Events Content', function () {
  let fields;
  let data;
  let transactionName;
  let eventView;
  let initialData;
  const query =
    'transaction.duration:<15m event.type:transaction transaction:/api/0/organizations/{organization_slug}/events/';
  beforeEach(function () {
    transactionName = 'transactionName';
    fields = [
      'id',
      'user.display',
      SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
      'transaction.duration',
      'trace',
      'timestamp',
      'spans.total.time',
      ...SPAN_OP_BREAKDOWN_FIELDS,
    ];
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
    data = [
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
        data: [{'count()': 200}],
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
    initialData = initializeData();
    eventView = EventView.fromNewQueryWithLocation(
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
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.clearAllMocks();
  });

  it('basic rendering', function () {
    render(
      <OrganizationContext.Provider value={initialData.organization}>
        <EventsPageContent
          eventView={eventView}
          organization={initialData.organization}
          location={initialData.router.location}
          transactionName={transactionName}
          spanOperationBreakdownFilter={SpanOperationBreakdownFilter.NONE}
          onChangeSpanOperationBreakdownFilter={() => {}}
          eventsDisplayFilterName={EventsDisplayFilterName.P100}
          onChangeEventsDisplayFilter={() => {}}
          setError={() => {}}
          projectId="123"
          projects={[]}
        />
      </OrganizationContext.Provider>,
      {context: initialData.routerContext}
    );

    expect(screen.getByTestId('events-table')).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher('Percentilep100'))).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(t('Search for events, users, tags, and more'))
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Filter by operation'})).toBeInTheDocument();

    const columnTitles = screen
      .getAllByRole('columnheader')
      .map(elem => elem.textContent);
    expect(columnTitles).toEqual([
      t('event id'),
      t('user'),
      t('operation duration'),
      t('total duration'),
      t('trace id'),
      t('timestamp'),
    ]);
  });

  it('rendering with webvital selected', function () {
    render(
      <OrganizationContext.Provider value={initialData.organization}>
        <EventsPageContent
          eventView={eventView}
          organization={initialData.organization}
          location={initialData.router.location}
          transactionName={transactionName}
          spanOperationBreakdownFilter={SpanOperationBreakdownFilter.NONE}
          onChangeSpanOperationBreakdownFilter={() => {}}
          eventsDisplayFilterName={EventsDisplayFilterName.P100}
          onChangeEventsDisplayFilter={() => {}}
          webVital={WebVital.LCP}
          setError={() => {}}
          projectId="123"
          projects={[]}
        />
      </OrganizationContext.Provider>,
      {context: initialData.routerContext}
    );

    expect(screen.getByTestId('events-table')).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher('Percentilep100'))).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(t('Search for events, users, tags, and more'))
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Filter by operation'})).toBeInTheDocument();

    const columnTitles = screen
      .getAllByRole('columnheader')
      .map(elem => elem.textContent);
    expect(columnTitles).toStrictEqual(expect.arrayContaining([t('measurements.lcp')]));
  });

  it('rendering with http.method', function () {
    const _eventView = EventView.fromNewQueryWithLocation(
      {
        id: undefined,
        version: 2,
        name: 'transactionName',
        fields,
        query,
        projects: [1],
        orderby: '-timestamp',
      },
      initialData.router.location
    );
    render(
      <OrganizationContext.Provider value={initialData.organization}>
        <EventsPageContent
          eventView={_eventView}
          organization={initialData.organization}
          location={initialData.router.location}
          transactionName={transactionName}
          spanOperationBreakdownFilter={SpanOperationBreakdownFilter.NONE}
          onChangeSpanOperationBreakdownFilter={() => {}}
          eventsDisplayFilterName={EventsDisplayFilterName.P100}
          onChangeEventsDisplayFilter={() => {}}
          webVital={WebVital.LCP}
          setError={() => {}}
          projectId="1"
          projects={[ProjectFixture({id: '1', platform: 'python'})]}
        />
      </OrganizationContext.Provider>,
      {context: initialData.routerContext}
    );

    const columnTitles = screen
      .getAllByRole('columnheader')
      .map(elem => elem.textContent);
    expect(columnTitles).toStrictEqual(expect.arrayContaining([t('http.method')]));
  });
});
