import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventView from 'app/utils/discover/eventView';
import SummaryContent from 'app/views/performance/transactionSummary/content';
import {SpanOperationBreakdownFilter} from 'app/views/performance/transactionSummary/filter';

function initialize(projects, query) {
  const features = ['transaction-event', 'performance-view'];
  const organization = TestStubs.Organization({
    features,
    projects,
  });
  const initialOrgData = {
    organization,
    router: {
      location: {
        query: {...query},
      },
    },
  };
  const initialData = initializeOrg(initialOrgData);
  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: 'test-transaction',
      fields: ['id', 'user.display', 'transaction.duration', 'trace', 'timestamp'],
      projects: [],
    },
    initialData.router.location
  );

  const spanOperationBreakdownFilter = SpanOperationBreakdownFilter.None;
  const transactionName = 'example-transaction';

  return {
    ...initialData,
    spanOperationBreakdownFilter,
    transactionName,
    location: initialData.router.location,
    eventView,
  };
}

describe('Transaction Summary Content', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
    });
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/sdk-updates/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/eventsv2/',
    body: {data: [{'event.type': 'error'}], meta: {'event.type': 'string'}},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/users/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url:
      '/organizations/org-slug/issues/?limit=5&query=is%3Aunresolved%20transaction%3Aexample-transaction&sort=new&statsPeriod=14d',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-facets/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/releases/stats/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-stats/',
    body: [],
  });

  it('does not query for maximum span duration when not in a span operation filter', async function () {
    const projects = [TestStubs.Project()];
    const {
      organization,
      location,
      eventView,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(projects, {});
    const routerContext = TestStubs.routerContext([{organization}]);

    const wrapper = mountWithTheme(
      <SummaryContent
        location={location}
        organization={organization}
        eventView={eventView}
        transactionName={transactionName}
        isLoading={false}
        totalValues={null}
        spanOperationBreakdownFilter={spanOperationBreakdownFilter}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('MaxSpanQuery')).toHaveLength(1);
    expect(wrapper.find('DiscoverQuery')).toHaveLength(2);
  });

  it('queries for maximum span duration when in a span operation filter', async function () {
    const expectedFields = [
      {field: 'spans.http', width: -1},
      {field: 'timestamp', width: -1},
    ];
    const projects = [TestStubs.Project()];
    const {organization, location, eventView, transactionName} = initialize(projects, {});
    const routerContext = TestStubs.routerContext([{organization}]);
    const spanOperationBreakdownFilter = SpanOperationBreakdownFilter.Http;

    const wrapper = mountWithTheme(
      <SummaryContent
        location={location}
        organization={organization}
        eventView={eventView}
        transactionName={transactionName}
        isLoading={false}
        totalValues={null}
        spanOperationBreakdownFilter={spanOperationBreakdownFilter}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('MaxSpanQuery')).toHaveLength(1);
    expect(wrapper.find('DiscoverQuery')).toHaveLength(3);
    expect(wrapper.find('DiscoverQuery').first().prop('eventView').fields).toEqual(
      expectedFields
    );
  });
});
