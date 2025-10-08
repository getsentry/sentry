import {AutomationFixture} from 'sentry-fixture/automations';
import {
  ErrorDetectorFixture,
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {MetricsFieldFixture} from 'sentry-fixture/metrics';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {SnubaQueryType} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import DetectorEdit from 'sentry/views/detectors/edit';

describe('DetectorEdit', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui', 'visibility-explore-view'],
  });
  const project = ProjectFixture({id: '1', organization, environments: ['production']});
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
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });

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

  describe('EditDetectorActions', () => {
    const mockDetector = MetricDetectorFixture();

    it('calls delete mutation when deletion is confirmed', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        body: mockDetector,
      });

      const mockDeleteDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        method: 'DELETE',
      });

      const {router} = render(<DetectorEdit />, {organization, initialRouterConfig});
      renderGlobalModal();

      expect(
        await screen.findByRole('link', {name: mockDetector.name})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

      // Confirm the deletion
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', {name: 'Delete'}));

      expect(mockDeleteDetector).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        expect.anything()
      );

      // Redirect to the monitors list
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/issues/monitors/`
      );
    });

    it('calls update mutation when enabling/disabling automation', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        body: mockDetector,
      });

      const mockUpdateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        method: 'PUT',
        body: {...mockDetector, enabled: !mockDetector.enabled},
      });

      render(<DetectorEdit />, {organization, initialRouterConfig});

      expect(
        await screen.findByRole('link', {name: mockDetector.name})
      ).toBeInTheDocument();

      // Wait for the component to load and display automation actions
      expect(await screen.findByRole('button', {name: 'Disable'})).toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        body: {...mockDetector, enabled: !mockDetector.enabled},
      });

      // Click the toggle button to enable/disable the automation
      await userEvent.click(screen.getByRole('button', {name: 'Disable'}));

      // Verify the mutation was called with correct data
      await waitFor(() => {
        expect(mockUpdateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
          expect.objectContaining({
            data: {detectorId: mockDetector.id, enabled: !mockDetector.enabled},
          })
        );
      });

      // Verify the button text has changed to "Enable"
      expect(await screen.findByRole('button', {name: 'Enable'})).toBeInTheDocument();
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

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/metrics/data/`,
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

    it('sets resolution method to Default when OK equals critical threshold', async () => {
      const detectorWithOkEqualsHigh = MetricDetectorFixture({
        conditionGroup: {
          id: 'cg2',
          logicType: DataConditionGroupLogicType.ANY,
          conditions: [
            {
              id: 'c-main',
              type: DataConditionType.GREATER,
              comparison: 5,
              conditionResult: DetectorPriorityLevel.MEDIUM,
            },
            {
              id: 'c-high',
              type: DataConditionType.GREATER,
              comparison: 10,
              conditionResult: DetectorPriorityLevel.HIGH,
            },
            {
              id: 'c-ok',
              type: DataConditionType.LESS,
              comparison: 10, // equals high threshold
              conditionResult: DetectorPriorityLevel.OK,
            },
          ],
        },
        dataSources: [SnubaQueryDataSourceFixture()],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${detectorWithOkEqualsHigh.id}/`,
        body: detectorWithOkEqualsHigh,
      });

      render(<DetectorEdit />, {organization, initialRouterConfig});

      expect(
        await screen.findByRole('link', {name: detectorWithOkEqualsHigh.name})
      ).toBeInTheDocument();

      expect(screen.getByText('Default').closest('label')).toHaveClass(
        'css-1aktlwe-RadioLineItem'
      );

      // Switching to Custom should reveal prefilled resolution input with the current OK value
      await userEvent.click(screen.getByText('Custom').closest('label')!);
      const resolutionInput = await screen.findByLabelText('Resolution threshold');
      expect(resolutionInput).toHaveValue(10);
    });

    it('includes comparisonDelta in events-stats request when using percent change detection', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        body: mockDetector,
      });

      const eventsStatsRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
        body: {data: []},
      });

      const updateRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        method: 'PUT',
        body: mockDetector,
      });

      render(<DetectorEdit />, {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/issues/monitors/:detectorId/edit/',
          location: {
            pathname: `/organizations/${organization.slug}/issues/monitors/${mockDetector.id}/edit/`,
          },
        },
      });

      expect(await screen.findByRole('link', {name})).toBeInTheDocument();

      // Switch to percent change detection
      await userEvent.click(screen.getByRole('radio', {name: 'Change'}));

      // Set % change value to 10%
      const newThresholdValue = '22';
      await userEvent.clear(screen.getByLabelText('Initial threshold'));
      await userEvent.type(screen.getByLabelText('Initial threshold'), newThresholdValue);

      // Wait for the events-stats request to be made with comparisonDelta
      // Default comparisonDelta is 1 hour (3600 seconds)
      await waitFor(() => {
        expect(eventsStatsRequest).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/events-stats/`,
          expect.objectContaining({
            query: expect.objectContaining({
              comparisonDelta: 3600,
            }),
          })
        );
      });

      // Save changes and verify the update request includes comparisonDelta
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      await waitFor(() => {
        expect(updateRequest).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/1/`,
          expect.objectContaining({
            method: 'PUT',
            data: expect.objectContaining({
              config: expect.objectContaining({
                detectionType: 'percent',
                comparisonDelta: 3600,
              }),
            }),
          })
        );
      });
      const updateBody = updateRequest.mock.calls[0][1];
      expect(updateBody.data.conditionGroup.conditions[0]).toEqual({
        comparison: Number(newThresholdValue),
        conditionResult: 75,
        type: 'gt',
      });
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

    it('disables column select when spans + count()', async () => {
      const spansDetector = MetricDetectorFixture({
        dataSources: [
          SnubaQueryDataSourceFixture({
            queryObj: {
              id: '1',
              status: 1,
              subscription: '1',
              snubaQuery: {
                aggregate: 'count()',
                dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                id: '',
                query: '',
                timeWindow: 60,
                eventTypes: [EventTypes.TRACE_ITEM_SPAN],
              },
            },
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${spansDetector.id}/`,
        body: spansDetector,
      });

      render(<DetectorEdit />, {
        organization,
        initialRouterConfig,
      });

      expect(
        await screen.findByRole('link', {name: spansDetector.name})
      ).toBeInTheDocument();

      // Column parameter should be locked to "spans" and disabled
      const button = screen.getByRole('button', {name: 'spans'});
      expect(button).toBeDisabled();
    });

    it('resets 1 day interval to 15 minutes when switching to dynamic detection', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        body: mockDetector,
      });

      render(<DetectorEdit />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByRole('link', {name})).toBeInTheDocument();

      // Set interval to 1 day
      const intervalField = screen.getByLabelText('Interval');
      await userEvent.click(intervalField);
      await userEvent.click(screen.getByRole('menuitemradio', {name: '1 day'}));

      // Switch to dynamic detection
      await userEvent.click(screen.getByRole('radio', {name: 'Dynamic'}));

      // Verify interval changed to 15 minutes
      expect(await screen.findByText('15 minutes')).toBeInTheDocument();
    });

    it('calls anomaly API when using dynamic detection', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
        body: mockDetector,
      });

      // Current data for chart
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
        match: [MockApiClient.matchQuery({statsPeriod: '9998m'})],
        body: {
          data: [
            [1609459200000, [{count: 100}]],
            [1609462800000, [{count: 120}]],
            [1609466400000, [{count: 90}]],
            [1609470000000, [{count: 150}]],
          ],
        },
      });

      // Historical data
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
        match: [MockApiClient.matchQuery({statsPeriod: '35d'})],
        body: {
          data: [
            [1607459200000, [{count: 80}]],
            [1607462800000, [{count: 95}]],
            [1607466400000, [{count: 110}]],
            [1607470000000, [{count: 75}]],
          ],
        },
      });

      const anomalyRequest = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/anomalies/`,
        method: 'POST',
        body: [],
      });

      render(<DetectorEdit />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByRole('link', {name})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', {name: 'Dynamic'}));

      await waitFor(() => {
        expect(anomalyRequest).toHaveBeenCalled();
      });
      const payload = anomalyRequest.mock.calls[0][1];
      expect(payload.data).toEqual({
        config: {
          direction: 'both',
          expected_seasonality: 'auto',
          sensitivity: 'medium',
          time_period: 15,
        },
        current_data: [
          [1609459200000, {count: 100}],
          [1609462800000, {count: 120}],
          [1609466400000, {count: 90}],
          [1609470000000, {count: 150}],
        ],
        historical_data: [
          [1607459200000, {count: 80}],
          [1607462800000, {count: 95}],
          [1607466400000, {count: 110}],
          [1607470000000, {count: 75}],
        ],
        organization_id: organization.id,
        project_id: project.id,
      });
    });

    describe('releases dataset', () => {
      it('can save crash_free_rate(sessions)', async () => {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
          body: mockDetector,
        });

        const updateRequest = MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/detectors/${mockDetector.id}/`,
          method: 'PUT',
          body: mockDetector,
        });

        render(<DetectorEdit />, {
          organization,
          initialRouterConfig,
        });

        expect(await screen.findByRole('link', {name})).toBeInTheDocument();

        // Change dataset to releases
        const datasetField = screen.getByLabelText('Dataset');
        await userEvent.click(datasetField);
        await userEvent.click(screen.getByRole('menuitemradio', {name: 'Releases'}));

        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
          expect(updateRequest).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              data: expect.objectContaining({
                dataSource: expect.objectContaining({
                  // Aggreate needs to be transformed to this in order to save correctly
                  aggregate:
                    'percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate',
                  dataset: Dataset.METRICS,
                  eventTypes: [],
                  queryType: SnubaQueryType.CRASH_RATE,
                }),
              }),
            })
          );
        });
      });
    });
  });
});
