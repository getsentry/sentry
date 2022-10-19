import {InjectedRouter} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import SummaryContent from 'sentry/views/performance/transactionSummary/transactionOverview/content';
import {RouteContext} from 'sentry/views/routeContext';

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
  router,
  ...props
}: React.ComponentProps<typeof SummaryContent> & {
  router: InjectedRouter<Record<string, string>, any>;
}) => {
  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider value={{router, ...router}}>
        <MEPSettingProvider>
          <SummaryContent organization={organization} {...props} />
        </MEPSettingProvider>
      </RouteContext.Provider>
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

  it('performs basic rendering', function () {
    const project = TestStubs.Project();
    const {
      organization,
      location,
      eventView,
      spanOperationBreakdownFilter,
      transactionName,
      router,
    } = initialize(project, {});
    const routerContext = TestStubs.routerContext([{organization}]);

    render(
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
        router={router}
      />,
      {context: routerContext}
    );

    expect(screen.getByTestId('page-filter-environment-selector')).toBeInTheDocument();
    expect(screen.getByTestId('page-filter-timerange-selector')).toBeInTheDocument();
    expect(screen.getByTestId('smart-search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('transaction-summary-charts')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /user misery/i})).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: /status breakdown/i})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /apdex/i})).toBeInTheDocument();
    expect(screen.getByTestId('apdex-summary-value')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: /failure rate/i})).toBeInTheDocument();
    expect(screen.getByTestId('failure-rate-summary-value')).toBeInTheDocument();
  });
});
