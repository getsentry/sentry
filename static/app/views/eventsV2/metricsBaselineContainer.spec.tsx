import {initializeOrg} from 'sentry-test/initializeOrg';
import {addMetricsDataMock} from 'sentry-test/performance/addMetricsDataMock';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types/organization';
import {Project} from 'sentry/types/project';
import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';

import {MetricsBaselineContainer} from './metricsBaselineContainer';

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
        eventView={eventView}
        api={api}
        confirmedQuery
        location={location}
        router={initialData.router}
        yAxis={yAxis}
      />
    </MetricsCardinalityProvider>
  );
}

describe('MetricsBaselineContainer', function () {
  const features = ['discover-basic'];
  const project = TestStubs.Project();
  const eventView = EventView.fromSavedQuery({
    id: '',
    name: 'test query',
    version: 2,
    fields: ['transaction', 'p50(transaction.duration)'],
    projects: [project.id],
  });

  let eventsStatsMock: jest.Mock | undefined;

  beforeEach(function () {
    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
  });

  it('enables processed baseline toggle if metrics cardinality conditions met', async function () {
    addMetricsDataMock();
    const organization = TestStubs.Organization({
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
  });

  it('disables processed baseline toggle if metrics cardinality conditions not met', function () {
    const organization = TestStubs.Organization({
      features: [...features, 'discover-metrics-baseline'],
    });

    const yAxis = ['p50(transaction.duration)'];

    renderMetricsBaselineContainer(organization, project, eventView, yAxis);

    expect(screen.getByText(/Processed events/i)).toBeInTheDocument();
    expect(screen.getByTestId('processed-events-toggle')).toBeDisabled();
  });

  it('disables toggle if discover hits the events dataset', function () {
    addMetricsDataMock();
    const organization = TestStubs.Organization({
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
});
