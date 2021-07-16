import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {t} from 'app/locale';
import ProjectsStore from 'app/stores/projectsStore';
import EventView from 'app/utils/discover/eventView';
import {
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
  WebVital,
} from 'app/utils/discover/fields';
import {SpanOperationBreakdownFilter} from 'app/views/performance/transactionSummary/filter';
import EventsPageContent from 'app/views/performance/transactionSummary/transactionEvents/content';
import {EventsDisplayFilterName} from 'app/views/performance/transactionSummary/transactionEvents/utils';

type Data = {
  features: string[];
};

function initializeData({features: additionalFeatures = []}: Data) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  // @ts-expect-error
  const organization = TestStubs.Organization({
    features,
    // @ts-expect-error
    projects: [TestStubs.Project()],
    apdexThreshold: 400,
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
    project: 1,
    projects: [],
  });
  ProjectsStore.loadInitialData(initialData.organization.projects);
  return initialData;
}

describe('Performance Transaction Events Content', function () {
  let fields;
  let organization;
  let data;
  let transactionName;
  let eventView;
  let initialData;
  const query =
    'transaction.duration:<15m event.type:transaction transaction:/api/0/organizations/{organization_slug}/eventsv2/';
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
    // @ts-expect-error
    organization = TestStubs.Organization();
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/is-key-transactions/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    // @ts-expect-error
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/legacy-key-transactions-count/`,
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
    // Transaction list response
    // @ts-expect-error
    MockApiClient.addMockResponse(
      {
        url: '/organizations/org-slug/eventsv2/',
        headers: {
          Link:
            '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",' +
            '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"',
        },
        body: {
          meta: {
            id: 'string',
            'user.display': 'string',
            'transaction.duration': 'duration',
            'project.id': 'integer',
            timestamp: 'date',
          },
          data,
        },
      },
      {
        predicate: (url, options) => {
          return (
            url.includes('eventsv2') && options.query?.field.includes('user.display')
          );
        },
      }
    );
    initialData = initializeData({features: ['performance-events-page']});
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
    // @ts-expect-error
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.clearAllMocks();
  });

  it('basic rendering', async function () {
    const wrapper = mountWithTheme(
      <EventsPageContent
        eventView={eventView}
        organization={organization}
        location={initialData.router.location}
        transactionName={transactionName}
        projects={initialData.projects}
        spanOperationBreakdownFilter={SpanOperationBreakdownFilter.None}
        onChangeSpanOperationBreakdownFilter={() => {}}
        eventsDisplayFilterName={EventsDisplayFilterName.p100}
        onChangeEventsDisplayFilter={() => {}}
        isLoading={false}
      />,
      initialData.routerContext
    );
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('EventsTable')).toHaveLength(1);
    expect(wrapper.find('SearchRowMenuItem')).toHaveLength(2);
    expect(wrapper.find('StyledSearchBar')).toHaveLength(1);
    expect(wrapper.find('Filter')).toHaveLength(1);
    expect(wrapper.find('TransactionHeader')).toHaveLength(1);

    const columnTitles = wrapper.find('EventsTable').props().columnTitles;
    expect(columnTitles).toEqual([
      t('event id'),
      t('user'),
      t('operation duration'),
      t('total duration'),
      t('trace id'),
      t('timestamp'),
    ]);
  });

  it('rendering with webvital selected', async function () {
    const wrapper = mountWithTheme(
      <EventsPageContent
        eventView={eventView}
        organization={organization}
        location={initialData.router.location}
        transactionName={transactionName}
        projects={initialData.projects}
        spanOperationBreakdownFilter={SpanOperationBreakdownFilter.None}
        onChangeSpanOperationBreakdownFilter={() => {}}
        eventsDisplayFilterName={EventsDisplayFilterName.p100}
        onChangeEventsDisplayFilter={() => {}}
        isLoading={false}
        webVital={WebVital.LCP}
      />,
      initialData.routerContext
    );
    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('EventsTable')).toHaveLength(1);
    expect(wrapper.find('SearchRowMenuItem')).toHaveLength(2);
    expect(wrapper.find('StyledSearchBar')).toHaveLength(1);
    expect(wrapper.find('Filter')).toHaveLength(1);
    expect(wrapper.find('TransactionHeader')).toHaveLength(1);

    const columnTitles = wrapper.find('EventsTable').props().columnTitles;
    expect(columnTitles).toEqual([
      t('event id'),
      t('user'),
      t('operation duration'),
      t('measurements.lcp'),
      t('total duration'),
      t('trace id'),
      t('timestamp'),
    ]);
  });
});
