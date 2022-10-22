import ReactEchartsCore from 'echarts-for-react/lib/core';
import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {addMetricsDataMock} from 'sentry-test/performance/addMetricsDataMock';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types/organization';
import {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';

import {MetricsBaselineContainer} from './metricsBaselineContainer';

jest.mock('echarts-for-react/lib/core', () => {
  return jest.fn(({style}) => {
    return <div style={{...style, background: 'green'}}>echarts mock</div>;
  });
});

export function renderMetricsBaselineContainer(
  organization: Organization,
  project: Project,
  eventView: EventView,
  yAxis: string[]
) {
  const routerLocation: {query: {project?: number}} = {
    query: {project: parseInt(project.id, 10)},
  };

  const router = {
    location: routerLocation,
  };

  const initialData = initializeOrg({
    organization,
    projects: [project],
    project,
    router,
  });
  const location = initialData.router.location;
  const api = new MockApiClient();
  render(
    <MetricsCardinalityProvider location={location} organization={organization}>
      <MetricsBaselineContainer
        organization={organization}
        total={100}
        onAxisChange={() => undefined}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        onIntervalChange={() => undefined}
        eventView={eventView}
        api={api}
        confirmedQuery
        location={location}
        router={initialData.router}
        yAxis={yAxis}
      />
    </MetricsCardinalityProvider>
  );

  return initialData.router;
}

describe('MetricsBaselineContainer', function () {
  const features = ['discover-basic'];
  const project = Project();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: 'test query',
    version: 2,
    fields: ['transaction', 'p50(transaction.duration)'],
    projects: [project.id],
  });

  let eventsStatsMock: jest.Mock | undefined;
  let eventsMock: jest.Mock | undefined;

  beforeEach(function () {
    (ReactEchartsCore as jest.Mock).mockClear();

    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [1663272000, [{count: 2066}]],
          [1663272300, [{count: 2158}]],
        ],
      },
    });

    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events/`,
      body: {
        data: [{}],
        meta: {},
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('enables processed baseline toggle if metrics cardinality conditions met', async function () {
    addMetricsDataMock();
    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events/`,
      body: {
        data: [{'count()': 19266771}],
        meta: {},
      },
    });
    const organization = Organization({
      features: [
        ...features,
        'discover-metrics-baseline',
        'server-side-sampling',
        'mep-rollout-flag',
      ],
    });
    const yAxis = ['p50(transaction.duration)'];

    renderMetricsBaselineContainer(organization, project, eventView, yAxis);

    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'metrics',
          }),
        })
      );
    });

    expect(eventsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'metrics',
        }),
      })
    );

    expect(screen.getByText(/Processed events/i)).toBeInTheDocument();
    expect(screen.getByText(/19m/i)).toBeInTheDocument();
    expect(screen.getByTestId('processed-events-toggle')).toBeEnabled();
  });

  it('displays metrics baseline', async function () {
    addMetricsDataMock();
    const organization = Organization({
      features: [
        ...features,
        'discover-metrics-baseline',
        'server-side-sampling',
        'mep-rollout-flag',
      ],
    });
    const yAxis = ['p50(transaction.duration)'];

    renderMetricsBaselineContainer(organization, project, eventView, yAxis);

    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'metrics',
          }),
        })
      );
    });

    expect(screen.getByText(/Processed events/i)).toBeInTheDocument();
    expect(screen.getByTestId('processed-events-toggle')).toBeEnabled();

    await waitFor(() => {
      expect(ReactEchartsCore).toHaveBeenLastCalledWith(
        expect.objectContaining({
          option: expect.objectContaining({
            legend: expect.objectContaining({
              data: expect.arrayContaining([
                'processed events: p50(transaction.duration)',
              ]),
            }),
          }),
        }),
        {}
      );
    });
  });

  it('disables processed baseline toggle if metrics cardinality conditions not met', function () {
    const organization = Organization({
      features: [...features, 'discover-metrics-baseline'],
    });

    const yAxis = ['p50(transaction.duration)'];

    renderMetricsBaselineContainer(organization, project, eventView, yAxis);

    expect(screen.getByText(/Processed events/i)).toBeInTheDocument();
    expect(screen.getByTestId('processed-events-toggle')).toBeDisabled();
  });

  it('disables toggle if discover hits the events dataset', function () {
    addMetricsDataMock();
    const organization = Organization({
      features: [
        ...features,
        'discover-metrics-baseline',
        'server-side-sampling',
        'mep-rollout-flag',
      ],
    });
    const yAxis = ['count()'];

    renderMetricsBaselineContainer(organization, project, eventView, yAxis);

    expect(screen.getByText(/Processed events/i)).toBeInTheDocument();
    expect(screen.getByTestId('processed-events-toggle')).toBeDisabled();
  });

  it('pushes toggle selection to URL', async function () {
    addMetricsDataMock();
    const organization = Organization({
      features: [
        ...features,
        'discover-metrics-baseline',
        'server-side-sampling',
        'mep-rollout-flag',
      ],
    });
    const yAxis = ['p50(transaction.duration)'];

    const router = renderMetricsBaselineContainer(
      organization,
      project,
      eventView,
      yAxis
    );

    await waitFor(() => {
      expect(eventsStatsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: 'metrics',
          }),
        })
      );
    });

    expect(screen.getByTestId('processed-events-toggle')).toBeEnabled();
    expect(screen.getByTestId('processed-events-toggle')).toBeChecked();
    userEvent.click(screen.getByTestId('processed-events-toggle'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: expect.objectContaining({baseline: '0'})})
    );
  });
});
