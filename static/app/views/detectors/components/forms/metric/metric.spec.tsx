import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import OrganizationStore from 'sentry/stores/organizationStore';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';
import {NewMetricDetectorForm} from 'sentry/views/detectors/components/forms/metric/metric';

describe('NewMetricDetectorForm', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui', 'visibility-explore-view'],
  });
  const project = ProjectFixture({id: '1', slug: 'proj-1'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    OrganizationStore.reset();
    OrganizationStore.onUpdate(organization);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      body: {measurements: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/is/values/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });
  });

  it('removes is filters when switching away from the errors dataset', async () => {
    render(
      <DetectorFormProvider detectorType="metric_issue" project={project}>
        <NewMetricDetectorForm />
      </DetectorFormProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/new/metric/',
            query: {
              dataset: 'errors',
              query: 'is:unresolved status:500',
              project: project.id,
            },
          },
        },
      }
    );

    let search = await screen.findByTestId('search-query-builder');

    // Should have is:resolved and status:500 filters
    expect(within(search).getByRole('row', {name: 'is:unresolved'})).toBeInTheDocument();
    expect(within(search).getByRole('row', {name: 'status:500'})).toBeInTheDocument();

    // Switch to spans dataset
    await selectEvent.select(screen.getByLabelText(/dataset/i), 'Spans');

    search = await screen.findByTestId('search-query-builder');
    // is:unresolved filter should be removed
    expect(
      within(search).queryByRole('row', {name: 'is:unresolved'})
    ).not.toBeInTheDocument();
    // status:500 filter should still be present
    expect(within(search).getByRole('row', {name: 'status:500'})).toBeInTheDocument();
  });
});
