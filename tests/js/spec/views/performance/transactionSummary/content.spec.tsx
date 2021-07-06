import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventView from 'app/utils/discover/eventView';
import SummaryContent from 'app/views/performance/transactionSummary/content';
import {SpanOperationBreakdownFilter} from 'app/views/performance/transactionSummary/filter';

function initialize(projects, query, additionalFeatures: string[] = []) {
  const features = ['transaction-event', 'performance-view', ...additionalFeatures];
  // @ts-expect-error
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
    project: 1,
    projects: [],
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
    // @ts-expect-error
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
    });
  });
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/sdk-updates/',
    body: [],
  });
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/eventsv2/',
    body: {data: [{'event.type': 'error'}], meta: {'event.type': 'string'}},
  });
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/users/',
    body: [],
  });
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues/?limit=5&query=is%3Aunresolved%20transaction%3Aexample-transaction&sort=new&statsPeriod=14d',
    body: [],
  });
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-facets/',
    body: [],
  });
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/releases/stats/',
    body: [],
  });
  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-stats/',
    body: [],
  });

  it('Basic Rendering', async function () {
    // @ts-expect-error
    const projects = [TestStubs.Project()];
    const {
      organization,
      location,
      eventView,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(projects, {});
    // @ts-expect-error
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
        error={null}
        onChangeFilter={() => {}}
      />,
      routerContext
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('TransactionHeader')).toHaveLength(1);
    expect(wrapper.find('Filter')).toHaveLength(1);
    expect(wrapper.find('StyledSearchBar')).toHaveLength(1);
    expect(wrapper.find('TransactionSummaryCharts')).toHaveLength(1);
    expect(wrapper.find('TransactionsList')).toHaveLength(1);
    expect(wrapper.find('UserStats')).toHaveLength(1);
    expect(wrapper.find('StatusBreakdown')).toHaveLength(1);
    expect(wrapper.find('SidebarCharts')).toHaveLength(1);
    expect(wrapper.find('DiscoverQuery')).toHaveLength(2);

    const transactionListProps = wrapper.find('TransactionsList').first().props();
    expect(transactionListProps.generateDiscoverEventView).toBeDefined();
    expect(transactionListProps.handleOpenInDiscoverClick).toBeDefined();
    expect(transactionListProps.generatePerformanceTransactionEventsView).toBeUndefined();
    expect(transactionListProps.handleOpenAllEventsClick).toBeUndefined();
  });

  it('Renders with generatePerformanceTransactionEventsView instead when feature flagged', async function () {
    // @ts-expect-error
    const projects = [TestStubs.Project()];
    const {
      organization,
      location,
      eventView,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(projects, {}, ['performance-events-page']);
    // @ts-expect-error
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
        error={null}
        onChangeFilter={() => {}}
      />,
      routerContext
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    expect(wrapper.find('TransactionHeader')).toHaveLength(1);
    expect(wrapper.find('Filter')).toHaveLength(1);
    expect(wrapper.find('StyledSearchBar')).toHaveLength(1);
    expect(wrapper.find('TransactionSummaryCharts')).toHaveLength(1);
    expect(wrapper.find('TransactionsList')).toHaveLength(1);
    expect(wrapper.find('UserStats')).toHaveLength(1);
    expect(wrapper.find('StatusBreakdown')).toHaveLength(1);
    expect(wrapper.find('SidebarCharts')).toHaveLength(1);
    expect(wrapper.find('DiscoverQuery')).toHaveLength(2);

    const transactionListProps = wrapper.find('TransactionsList').first().props();
    expect(transactionListProps.generateDiscoverEventView).toBeUndefined();
    expect(transactionListProps.handleOpenInDiscoverClick).toBeUndefined();
    expect(transactionListProps.generatePerformanceTransactionEventsView).toBeDefined();
    expect(transactionListProps.handleOpenAllEventsClick).toBeDefined();
  });
});
