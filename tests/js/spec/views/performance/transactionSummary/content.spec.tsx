import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventView from 'sentry/utils/discover/eventView';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import SummaryContent from 'sentry/views/performance/transactionSummary/transactionOverview/content';

function initialize(project, query, additionalFeatures: string[] = []) {
  const features = ['transaction-event', 'performance-view', ...additionalFeatures];
  const organization = TestStubs.Organization({
    features,
    projects: [project],
  });
  const initialOrgData = {
    organization,
    router: {
      location: {
        query: {...query},
      },
    },
    project: parseInt(project.id, 10),
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

const WrappedComponent = ({
  organization,
  ...props
}: React.ComponentProps<typeof SummaryContent>) => {
  return (
    <OrganizationContext.Provider value={organization}>
      <SummaryContent organization={organization} {...props} />
    </OrganizationContext.Provider>
  );
};

describe('Transaction Summary Content', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
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
      url: '/organizations/org-slug/issues/?limit=5&query=is%3Aunresolved%20transaction%3Aexample-transaction&sort=new&statsPeriod=14d',
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets-performance/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('Basic Rendering', async function () {
    const project = TestStubs.Project();
    const {
      organization,
      location,
      eventView,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(project, {});
    const routerContext = TestStubs.routerContext([{organization}]);

    const wrapper = mountWithTheme(
      <WrappedComponent
        location={location}
        organization={organization}
        eventView={eventView}
        projectId={project.id}
        transactionName={transactionName}
        isLoading={false}
        totalValues={null}
        spanOperationBreakdownFilter={spanOperationBreakdownFilter}
        error={null}
        onChangeFilter={() => {}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('Filter')).toHaveLength(1);
    expect(wrapper.find('SearchBar')).toHaveLength(1);
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

  it('Renders TransactionSummaryCharts withoutZerofill', async function () {
    const project = TestStubs.Project();
    const {
      organization,
      location,
      eventView,
      spanOperationBreakdownFilter,
      transactionName,
    } = initialize(project, {}, ['performance-chart-interpolation']);
    const routerContext = TestStubs.routerContext([{organization}]);

    const wrapper = mountWithTheme(
      <WrappedComponent
        location={location}
        organization={organization}
        eventView={eventView}
        projectId={project.id}
        transactionName={transactionName}
        isLoading={false}
        totalValues={null}
        spanOperationBreakdownFilter={spanOperationBreakdownFilter}
        error={null}
        onChangeFilter={() => {}}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('TransactionSummaryCharts')).toHaveLength(1);

    const transactionSummaryChartsProps = wrapper
      .find('TransactionSummaryCharts')
      .first()
      .props();
    expect(transactionSummaryChartsProps.withoutZerofill).toEqual(true);
  });
});
