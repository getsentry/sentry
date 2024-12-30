import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import DashboardWidgetQuerySelectorModal from 'sentry/components/modals/dashboardWidgetQuerySelectorModal';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

const stubEl: any = (props: any) => <div>{props.children}</div>;

const api = new MockApiClient();

function renderModal({
  initialData,
  widget,
}: {
  initialData: ReturnType<typeof initializeOrg>;
  widget: Widget;
}) {
  return render(
    <DashboardWidgetQuerySelectorModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      CloseButton={stubEl}
      closeModal={() => {}}
      organization={initialData.organization}
      widget={widget}
      api={api}
    />,
    {router: initialData.router}
  );
}

describe('Modals -> AddDashboardWidgetModal', function () {
  const initialData = initializeOrg({
    organization: {
      features: ['performance-view', 'discover-query'],
    },
    router: {},
    projects: [],
  });
  let mockQuery!: Widget['queries'][number];
  let mockWidget!: Widget;

  beforeEach(function () {
    mockQuery = {
      conditions: 'title:/organizations/:orgId/performance/summary/',
      fields: ['count()', 'failure_count()'],
      aggregates: ['count()', 'failure_count()'],
      columns: [],
      name: 'Query Name',
      orderby: '',
    };

    mockWidget = {
      title: 'Test Widget',
      displayType: DisplayType.AREA,
      interval: '5m',
      queries: [mockQuery],
    };
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/widgets/',
      method: 'POST',
      statusCode: 200,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {data: [{'event.type': 'error'}], meta: {'event.type': 'string'}},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [{id: '1', title: 'Test Dashboard'}],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a single query selection when the widget only has one query', function () {
    renderModal({initialData, widget: mockWidget});

    expect(
      screen.getByDisplayValue('title:/organizations/:orgId/performance/summary/')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeInTheDocument();
  });

  it('renders a multiple query selections when the widget only has multiple queries', function () {
    mockWidget.queries.push({
      ...mockQuery,
      conditions: 'title:/organizations/:orgId/performance/',
    });
    mockWidget.queries.push({
      ...mockQuery,
      conditions: 'title:/organizations/:orgId/',
    });
    renderModal({initialData, widget: mockWidget});
    const queryFields = screen.getAllByRole('textbox');
    expect(queryFields).toHaveLength(3);

    expect(
      screen.getByDisplayValue('title:/organizations/:orgId/performance/summary/')
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('title:/organizations/:orgId/performance/')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('title:/organizations/:orgId/')).toBeInTheDocument();
  });

  it('links user to the query in discover when a query is selected from the modal', function () {
    renderModal({initialData, widget: mockWidget});
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?field=count%28%29&field=failure_count%28%29&name=Test%20Widget&query=title%3A%2Forganizations%2F%3AorgId%2Fperformance%2Fsummary%2F&statsPeriod=14d&yAxis=count%28%29&yAxis=failure_count%28%29'
    );
  });
});
