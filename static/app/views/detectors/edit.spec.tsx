import {AutomationFixture} from 'sentry-fixture/automations';
import {ErrorDetectorFixture, MetricDetectorFixture} from 'sentry-fixture/detectors';
import {MetricsFieldFixture} from 'sentry-fixture/metrics';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import DetectorEdit from 'sentry/views/detectors/edit';

describe('DetectorEdit', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui', 'visibility-explore-view'],
  });
  const project = ProjectFixture({organization, environments: ['production']});
  const initialRouterConfig = {
    route: '/organizations/:orgId/issues/monitors/:detectorId/edit/',
    location: {
      pathname: '/organizations/org-slug/issues/monitors/1/edit/',
    },
  };

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

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      body: [AutomationFixture({id: '100', name: 'Workflow foo'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      match: [MockApiClient.matchQuery({ids: []})],
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      match: [MockApiClient.matchQuery({ids: ['100']})],
      body: [AutomationFixture({id: '100', name: 'Workflow foo'})],
    });
  });

  describe('Error', () => {
    const name = 'Test Error Detector';
    const mockDetector = ErrorDetectorFixture({id: '1', name, projectId: project.id});

    it('allows editing the detector name/environment and saving changes', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        body: mockDetector,
      });

      const updateRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        method: 'PUT',
        body: mockDetector,
      });

      const {router} = render(<DetectorEdit />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByRole('link', {name})).toBeInTheDocument();

      // Should have save button, but not disable or delete
      expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Disable'})).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Delete'})).not.toBeInTheDocument();

      // Can add an automation and save
      await userEvent.click(screen.getByRole('button', {name: 'Connect an Automation'}));
      const drawer = await screen.findByRole('complementary', {
        name: 'Connect Automations',
      });
      await userEvent.click(await within(drawer).findByRole('button', {name: 'Connect'}));
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(updateRequest).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/1/`,
          expect.objectContaining({
            method: 'PUT',
            data: expect.objectContaining({
              type: 'error',
              workflowIds: ['100'],
            }),
          })
        );
      });

      // Should navigate back to detector details page
      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/issues/monitors/1/`
        );
      });
    });
  });

  describe('Metric', () => {
    const name = 'Test Metric Detector';
    const mockDetector = MetricDetectorFixture({name, projectId: project.id});

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
        initialRouterConfig,
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
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'production'})
      );

      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

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
                conditions: [{comparison: 8, conditionResult: 75, type: 'gt'}],
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

    it('adjusts interval when switching datasets', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        body: mockDetector,
      });

      render(<DetectorEdit />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByRole('link', {name})).toBeInTheDocument();

      // Start with errors dataset and select 1 minute interval
      const datasetField = screen.getByLabelText('Dataset');
      await userEvent.click(datasetField);
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Errors'}));

      const intervalField = screen.getByLabelText('Interval');
      await userEvent.click(intervalField);
      await userEvent.click(screen.getByRole('menuitemradio', {name: '1 minute'}));

      // For errors dataset with 1 minute interval, verify the display options
      const initialDisplayButton = screen.getByRole('button', {name: /Display/});
      await userEvent.click(initialDisplayButton);
      expect(screen.getAllByRole('option')).toHaveLength(4);
      expect(screen.getByRole('option', {name: 'Last 6 hours'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Last 24 hours'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Last 3 days'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Last 7 days'})).toBeInTheDocument();
      // Close the dropdown
      await userEvent.click(initialDisplayButton);

      // Switch to spans dataset
      await userEvent.click(datasetField);
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Spans'}));

      // Verify interval automatically changed from 1 minute to 5 minutes (spans excludes 1 minute)
      expect(await screen.findByText('5 minutes')).toBeInTheDocument();

      // Check new time period display options for spans dataset with 5 minute interval
      const newDisplayButton = screen.getByRole('button', {name: /Display/});
      await userEvent.click(newDisplayButton);

      // For spans dataset with 5 minute interval, verify the display options
      expect(screen.getAllByRole('option')).toHaveLength(3);
      expect(screen.getByRole('option', {name: 'Last 24 hours'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Last 3 days'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Last 7 days'})).toBeInTheDocument();
    });

    it('hides detection type options when dataset is changed to releases', async () => {
      const testDetector = MetricDetectorFixture({
        name: 'Test Detector',
        projectId: project.id,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${testDetector.id}/`,
        body: testDetector,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/metrics/data/`,
        body: MetricsFieldFixture('count()'),
      });

      render(<DetectorEdit />, {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/issues/monitors/:detectorId/edit/',
          location: {
            pathname: `/organizations/${organization.slug}/issues/monitors/${testDetector.id}/edit/`,
          },
        },
      });

      expect(
        await screen.findByRole('link', {name: 'Test Detector'})
      ).toBeInTheDocument();

      // Verify detection type options are initially available
      expect(screen.getByText('Threshold')).toBeInTheDocument();
      expect(screen.getByText('Change')).toBeInTheDocument();

      // Change dataset to releases
      const datasetField = screen.getByLabelText('Dataset');
      await userEvent.click(datasetField);
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Releases'}));

      // Verify detection type options are no longer available
      expect(screen.queryByText('Change')).not.toBeInTheDocument();
      expect(screen.queryByText('Dynamic')).not.toBeInTheDocument();
    });
  });
});
