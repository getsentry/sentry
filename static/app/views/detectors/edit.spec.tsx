import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import DetectorEdit from 'sentry/views/detectors/edit';

describe('DetectorEdit | Metric Detector', () => {
  const name = 'Test Metric Detector';
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui'],
  });
  const project = ProjectFixture({organization, environments: ['production']});
  const mockDetector = MetricDetectorFixture({name, projectId: project.id});

  beforeEach(() => {
    OrganizationStore.init();
    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData([project]);

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {data: []},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/measurements-meta/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
  });

  it('allows editing the detector name/environment and saving changes', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
      body: mockDetector,
    });

    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
      method: 'PUT',
      body: {
        ...mockDetector,
        name: 'Updated Detector Name',
      },
    });

    const {router} = render(<DetectorEdit />, {
      organization,
      initialRouterConfig: {
        route: '/organizations/:orgId/issues/monitors/:detectorId/edit/',
        location: {
          pathname: `/organizations/${organization.slug}/issues/monitors/${mockDetector.id}/edit/`,
        },
      },
    });

    expect(await screen.findByRole('link', {name})).toBeInTheDocument();

    // Find the editable name field and change it
    const nameInput = screen.getByTestId('editable-text-label');
    expect(nameInput).toHaveTextContent(name);
    // Input appears on click
    await userEvent.click(nameInput);

    const nameInputField = await screen.findByRole('textbox', {name: /monitor name/i});
    await userEvent.clear(nameInputField);
    await userEvent.type(nameInputField, 'Updated Detector Name');

    // Update environment
    await userEvent.click(screen.getByText('All Environments'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'production'}));

    await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

    const snubaQuery = mockDetector.dataSources[0].queryObj!.snubaQuery;
    await waitFor(() => {
      expect(updateRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/detectors/1/`,
        expect.objectContaining({
          method: 'PUT',
          data: {
            detectorId: mockDetector.id,
            name: 'Updated Detector Name',
            owner: null,
            projectId: project.id,
            type: 'metric_issue',
            workflowIds: mockDetector.workflowIds,
            dataSource: {
              environment: 'production',
              aggregate: snubaQuery.aggregate,
              dataset: snubaQuery.dataset,
              query: snubaQuery.query,
              timeWindow: snubaQuery.timeWindow,
              eventTypes: ['error'],
              queryType: 0,
            },
            conditionGroup: {
              conditions: [{comparison: 8, conditionResult: 50, type: 'gt'}],
              logicType: 'any',
            },
            config: {detectionType: 'static', thresholdPeriod: 1},
          },
        })
      );
    });

    // Should navigate back to detector details page
    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/issues/monitors/1/`
    );
  });
});
