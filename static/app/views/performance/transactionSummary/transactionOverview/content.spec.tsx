import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {SpanOperationBreakdownFilter} from 'sentry/views/performance/transactionSummary/filter';
import SummaryContent from 'sentry/views/performance/transactionSummary/transactionOverview/content';

function initialize(query, additionalFeatures: string[] = []) {
  const features = ['transaction-event', 'performance-view', ...additionalFeatures];
  const organization = OrganizationFixture({
    features,
  });
  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {...query},
      },
    },
    projects: [],
  });
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

  const spanOperationBreakdownFilter = SpanOperationBreakdownFilter.NONE;
  const transactionName = 'example-transaction';

  return {
    ...initialData,
    spanOperationBreakdownFilter,
    transactionName,
    location: initialData.router.location,
    eventView,
  };
}

function WrappedComponent({
  organization,
  ...props
}: React.ComponentProps<typeof SummaryContent> & {
  router: InjectedRouter<Record<string, string>, any>;
}) {
  return (
    <MEPSettingProvider>
      <SummaryContent organization={organization} {...props} />
    </MEPSettingProvider>
  );
}

describe('Transaction Summary Content', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'event.type': 'error'}], meta: {fields: {'event.type': 'string'}}},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&query=is%3Aunresolved%20transaction%3Aexample-transaction&sort=trends&statsPeriod=14d',
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      body: [
        {
          op: 'ui.long-task',
          group: 'c777169faad84eb4',
          description: 'Main UI thread blocked',
          frequency: 713,
          count: 9040,
          avgOccurrences: null,
          sumExclusiveTime: 1743893.9822921753,
          p50ExclusiveTime: null,
          p75ExclusiveTime: 244.9998779296875,
          p95ExclusiveTime: null,
          p99ExclusiveTime: null,
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/profiling/functions/`,
      body: {functions: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      body: '',
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('performs basic rendering', async function () {
    const project = ProjectFixture();
    const {
      organization,
      location,
      eventView,
      spanOperationBreakdownFilter,
      transactionName,
      router,
    } = initialize({});

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
      {router, organization}
    );

    expect(
      await screen.findByTestId('page-filter-environment-selector')
    ).toBeInTheDocument();
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
