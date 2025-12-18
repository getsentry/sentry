import {AutomationFixture} from 'sentry-fixture/automations';
import {
  CronDetectorFixture,
  MetricDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import DetectorNewSettings from 'sentry/views/detectors/new-settings';

describe('DetectorEdit', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui', 'visibility-explore-view', 'performance-view'],
  });
  const project = ProjectFixture({organization, environments: ['production']});
  const initialRouterConfig = {
    route: '/organizations/:orgId/monitors/new/settings/',
    location: {
      pathname: '/organizations/org-slug/monitors/new/settings/',
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
  });

  describe('Metric Detector', () => {
    const metricRouterConfig = {
      ...initialRouterConfig,
      location: {
        ...initialRouterConfig.location,
        query: {detectorType: 'metric_issue', project: project.id},
      },
    };

    it('auto-generates name', async () => {
      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: metricRouterConfig,
      });
      await screen.findByText('New Monitor');

      // Enter threshold value
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '100'
      );

      // Name should be auto-generated from defaults (Errors + count())
      expect(await screen.findByTestId('editable-text-label')).toHaveTextContent(
        'Number of errors above 100 over past 1 hour'
      );

      // Switch to spans dataset to access span aggregates
      await userEvent.click(screen.getByText('Errors'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Spans'}));

      // Change aggregate from count() to p75(span.duration)
      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(await screen.findByRole('option', {name: 'p75'}));

      await waitFor(() => {
        expect(screen.getByTestId('editable-text-label')).toHaveTextContent(
          'p75(span.duration) above 100ms over past 1 hour'
        );
      });

      // Change dataset from Spans to Errors
      await userEvent.click(screen.getByText('Spans'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Errors'}));

      await waitFor(() => {
        expect(screen.getByTestId('editable-text-label')).toHaveTextContent(
          'Number of errors above 100 over past 1 hour'
        );
      });

      // Change interval from 1 hour to 4 hours
      await userEvent.click(screen.getByText('1 hour'));
      await userEvent.click(screen.getByRole('menuitemradio', {name: '4 hours'}));

      await waitFor(() => {
        expect(screen.getByTestId('editable-text-label')).toHaveTextContent(
          'Number of errors above 100 over past 4 hours'
        );
      });
    });

    it('can submit a new metric detector', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '123'}),
      });

      const {router} = render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: metricRouterConfig,
      });

      const title = await screen.findByText('New Monitor');
      await userEvent.click(title);
      await userEvent.keyboard('Foo{enter}');

      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '100'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Foo',
              type: 'metric_issue',
              projectId: project.id,
              owner: null,
              workflowIds: [],
              conditionGroup: {
                conditions: [
                  {
                    comparison: 100,
                    conditionResult: 75,
                    type: 'gt',
                  },
                  {
                    comparison: 100,
                    conditionResult: 0,
                    type: 'lte',
                  },
                ],
                logicType: 'any',
              },
              config: {
                detectionType: 'static',
              },
              dataSources: [
                {
                  aggregate: 'count()',
                  dataset: 'events',
                  eventTypes: ['default', 'error'],
                  query: 'is:unresolved',
                  queryType: 0,
                  timeWindow: 3600,
                  environment: null,
                },
              ],
            }),
          })
        );
      });

      // Should navigate to the new monitor page
      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/monitors/123/`
        );
      });
    });

    it('prefills form when selecting a template', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '123'}),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: metricRouterConfig,
      });

      await screen.findByText('New Monitor');

      await userEvent.click(screen.getByTestId('template-selector'));
      await userEvent.click(
        await screen.findByRole('option', {name: 'Number of Errors'})
      );

      // Verify form fields are pre-filled with template values
      await waitFor(() => {
        expect(screen.getByText('Errors')).toBeInTheDocument();
      });

      // Set threshold and submit
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '50'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              type: 'metric_issue',
              dataSources: [
                expect.objectContaining({
                  aggregate: 'count()',
                  dataset: 'events',
                  environment: null,
                  eventTypes: expect.arrayContaining(['error', 'default']),
                  query: 'is:unresolved',
                  queryType: 0,
                  timeWindow: 3600,
                }),
              ],
            }),
          })
        );
      });
    });

    it('prefills from URL query params and submits', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '123'}),
      });

      const prefilledRouterConfig = {
        ...metricRouterConfig,
        location: {
          ...metricRouterConfig.location,
          query: {
            ...metricRouterConfig.location.query,
            dataset: 'errors',
            aggregate: 'count_unique(user)',
            query: 'event.type:error',
            environment: 'prod',
            name: 'My Monitor',
          },
        },
      };

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: prefilledRouterConfig,
      });

      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '100'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Users experiencing errors above 100 over past 1 hour',
              type: 'metric_issue',
              projectId: project.id,
              owner: null,
              workflowIds: [],
              conditionGroup: {
                conditions: [
                  {
                    comparison: 100,
                    conditionResult: 75,
                    type: 'gt',
                  },
                  {
                    comparison: 100,
                    conditionResult: 0,
                    type: 'lte',
                  },
                ],
                logicType: 'any',
              },
              config: {detectionType: 'static'},
              dataSources: [
                {
                  aggregate: 'count_unique(tags[sentry:user])',
                  dataset: 'events',
                  environment: 'prod',
                  eventTypes: ['error'],
                  query: '',
                  queryType: 0,
                  timeWindow: 3600,
                },
              ],
            }),
          })
        );
      });
    }, 10000);

    it('can submit a new metric detector with event.type:error', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '123'}),
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/tags/event.type/values/`,
        body: [{name: 'error'}, {name: 'default'}],
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: metricRouterConfig,
      });

      const title = await screen.findByText('New Monitor');
      await userEvent.click(title);
      await userEvent.keyboard('Foo{enter}');

      const description = screen.getByRole('textbox', {name: 'description'});
      await userEvent.type(description, 'This is my metric monitor description');

      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '100'
      );

      await userEvent.click(screen.getByTestId('query-builder-input'));
      await userEvent.paste(
        // Filter to a specific event type
        'event.type:error'
      );

      await userEvent.click(screen.getByText('Create Monitor'));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              conditionGroup: {
                conditions: [
                  {comparison: 100, conditionResult: 75, type: 'gt'},
                  {comparison: 100, conditionResult: 0, type: 'lte'},
                ],
                logicType: 'any',
              },
              config: {detectionType: 'static'},
              dataSources: [
                {
                  aggregate: 'count()',
                  dataset: 'events',
                  environment: null,
                  // Event type has moved from the query to the eventTypes field
                  eventTypes: ['error'],
                  query: 'is:unresolved',
                  queryType: 0,
                  timeWindow: 3600,
                },
              ],
              name: 'Foo',
              description: 'This is my metric monitor description',
              owner: null,
              projectId: '2',
              type: 'metric_issue',
              workflowIds: [],
            }),
          })
        );
      });
    }, 10_000);

    it('submits manual resolution threshold when selected', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '321'}),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: metricRouterConfig,
      });

      // Set initial trigger threshold
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '100'
      );

      // Enable custom resolution and set resolution threshold
      await userEvent.click(screen.getByText('Custom').closest('label')!);
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'Resolution threshold'}),
        '80'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalled();
      });

      expect(mockCreateDetector).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/detectors/`,
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'metric_issue',
            conditionGroup: {
              logicType: 'any',
              conditions: [
                // Main trigger condition at HIGH
                {
                  comparison: 100,
                  conditionResult: 75,
                  type: 'gt',
                },
                // Manual resolution condition at OK
                {
                  comparison: 80,
                  conditionResult: 0,
                  type: 'lte',
                },
              ],
            },
          }),
        })
      );
    });

    it('uses medium threshold for default resolution when both high and medium are set', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '789'}),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: metricRouterConfig,
      });

      // Set High threshold to 100
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '100'
      );

      // Set Medium threshold to 50
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'Medium threshold'}),
        '50'
      );

      // Don't select Custom - should use default resolution (which should use MEDIUM)
      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalled();
      });

      expect(mockCreateDetector).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/detectors/`,
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'metric_issue',
            conditionGroup: {
              logicType: 'any',
              conditions: [
                // High priority condition
                {
                  comparison: 100,
                  conditionResult: 75,
                  type: 'gt',
                },
                // Medium priority condition
                {
                  comparison: 50,
                  conditionResult: 50,
                  type: 'gt',
                },
                // Default resolution condition uses MEDIUM threshold (50) with swapped operator
                {
                  comparison: 50,
                  conditionResult: 0,
                  type: 'lte',
                },
              ],
            },
          }),
        })
      );
    });

    it('hides transactions dataset when deprecateTransactionAlerts feature flag is enabled for new detectors', async () => {
      const organizationWithDeprecation = OrganizationFixture({
        features: [
          'workflow-engine-ui',
          'visibility-explore-view',
          'discover-saved-queries-deprecation',
        ],
      });

      render(<DetectorNewSettings />, {
        organization: organizationWithDeprecation,
        initialRouterConfig: metricRouterConfig,
      });

      // Open dataset dropdown
      await userEvent.click(screen.getByText('Errors'));

      // Verify transactions option is not available for new detectors
      expect(
        screen.queryByRole('menuitemradio', {name: 'Transactions'})
      ).not.toBeInTheDocument();

      // Verify other datasets are still available
      expect(screen.getByRole('menuitemradio', {name: 'Errors'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Spans'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Releases'})).toBeInTheDocument();
    });

    it('creates detector with dynamic detection and no resolution thresholds', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '456'}),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: metricRouterConfig,
      });

      const title = await screen.findByText('New Monitor');
      await userEvent.click(title);
      await userEvent.keyboard('Dynamic{enter}');

      // Select dynamic detection type
      await userEvent.click(screen.getByRole('radio', {name: 'Dynamic'}));

      // Set sensitivity to High
      await userEvent.click(
        screen.getByRole('textbox', {name: 'Level of responsiveness'})
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'High'}));

      // Set threshold type to Above
      await userEvent.click(
        screen.getByRole('textbox', {name: 'Direction of anomaly movement'})
      );
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Above'}));

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Dynamic',
              type: 'metric_issue',
              projectId: project.id,
              owner: null,
              workflowIds: [],
              // Dynamic detection should have anomaly detection condition
              conditionGroup: {
                conditions: [
                  {
                    type: 'anomaly_detection',
                    comparison: {
                      sensitivity: 'high',
                      seasonality: 'auto',
                      thresholdType: 0,
                    },
                    conditionResult: 75,
                  },
                ],
                logicType: 'any',
              },
              config: {
                detectionType: 'dynamic',
              },
              dataSources: [
                {
                  aggregate: 'count()',
                  dataset: 'events',
                  eventTypes: ['default', 'error'],
                  query: 'is:unresolved',
                  queryType: 0,
                  timeWindow: 3600,
                  environment: null,
                },
              ],
            }),
          })
        );
      });
    });

    it('can submit a new metric detector with apdex aggregate', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '789'}),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: metricRouterConfig,
      });

      const title = await screen.findByText('New Monitor');
      await userEvent.click(title);
      await userEvent.keyboard('Apdex{enter}');

      // Switch to Spans dataset to access apdex aggregate
      await userEvent.click(screen.getByText('Errors'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Spans'}));

      // Change aggregate from count to apdex
      await userEvent.click(screen.getByRole('button', {name: 'count'}));
      await userEvent.click(await screen.findByRole('option', {name: 'apdex'}));

      // Change to apdex(100)
      await userEvent.clear(screen.getByPlaceholderText('300'));
      await userEvent.type(screen.getByPlaceholderText('300'), '100');

      // Set the high threshold for alerting
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '100'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Apdex',
              type: 'metric_issue',
              projectId: project.id,
              owner: null,
              workflowIds: [],
              conditionGroup: {
                conditions: [
                  {
                    comparison: 100,
                    conditionResult: 75,
                    type: 'gt',
                  },
                  {
                    comparison: 100,
                    conditionResult: 0,
                    type: 'lte',
                  },
                ],
                logicType: 'any',
              },
              config: {
                detectionType: 'static',
              },
              dataSources: [
                {
                  aggregate: 'apdex(span.duration,100)',
                  dataset: 'events_analytics_platform',
                  eventTypes: ['trace_item_span'],
                  query: '',
                  queryType: 1,
                  timeWindow: 3600,
                  environment: null,
                },
              ],
            }),
          })
        );
      });
    });
  });

  describe('Uptime Detector', () => {
    const uptimeRouterConfig = {
      ...initialRouterConfig,
      location: {
        ...initialRouterConfig.location,
        query: {detectorType: 'uptime_domain_failure', project: project.id},
      },
    };

    it('shows detect and resolve fields and submits default thresholds', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: UptimeDetectorFixture(),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: uptimeRouterConfig,
      });

      const title = await screen.findByText('New Monitor');
      await userEvent.click(title);
      await userEvent.keyboard('Uptime Monitor{enter}');

      const description = screen.getByRole('textbox', {name: 'description'});
      await userEvent.type(description, 'This is my uptime monitor description');

      await userEvent.type(
        screen.getByRole('textbox', {name: 'URL'}),
        'https://uptime.example.com'
      );

      await selectEvent.select(screen.getByLabelText('Select Environment'), 'production');

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalled();
      });

      expect(mockCreateDetector).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/detectors/`,
        expect.objectContaining({
          data: expect.objectContaining({
            config: {
              downtimeThreshold: 3,
              environment: 'production',
              mode: 1,
              recoveryThreshold: 1,
            },
            dataSources: [
              {
                intervalSeconds: 60,
                method: 'GET',
                timeoutMs: 5000,
                traceSampling: undefined,
                url: 'https://uptime.example.com',
              },
            ],
            name: 'Uptime Monitor',
            description: 'This is my uptime monitor description',
            projectId: '2',
            type: 'uptime_domain_failure',
          }),
        })
      );
    });

    it('submits custom thresholds when changed', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: UptimeDetectorFixture(),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: uptimeRouterConfig,
      });

      await userEvent.type(
        screen.getByRole('textbox', {name: 'URL'}),
        'https://uptime-custom.example.com'
      );

      await selectEvent.select(screen.getByLabelText('Select Environment'), 'production');

      await userEvent.clear(screen.getByRole('spinbutton', {name: 'Failure Threshold'}));
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'Failure Threshold'}),
        '5'
      );

      await userEvent.clear(screen.getByRole('spinbutton', {name: 'Recovery Threshold'}));
      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'Recovery Threshold'}),
        '4'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalled();
      });

      expect(mockCreateDetector).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/detectors/`,
        expect.objectContaining({
          data: expect.objectContaining({
            config: {
              downtimeThreshold: '5',
              environment: 'production',
              mode: 1,
              recoveryThreshold: '4',
            },
            dataSources: [
              {
                intervalSeconds: 60,
                method: 'GET',
                timeoutMs: 5000,
                traceSampling: undefined,
                url: 'https://uptime-custom.example.com',
              },
            ],
            name: 'Uptime check for uptime-custom.example.com',
            projectId: '2',
            type: 'uptime_domain_failure',
          }),
        })
      );
    });

    it('automatically sets monitor name from URL and stops after manual edit', async () => {
      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: uptimeRouterConfig,
      });

      const nameField = await screen.findByText('New Monitor');

      // Type a simple hostname
      await userEvent.type(
        screen.getByRole('textbox', {name: 'URL'}),
        'https://my-cool-site.com/'
      );

      await screen.findByText('Uptime check for my-cool-site.com');

      // Clear and type a URL with a path - name should update
      let urlInput = screen.getByRole('textbox', {name: 'URL'});
      await userEvent.clear(urlInput);
      await userEvent.type(urlInput, 'https://example.com/with-path');

      // Name was updated with auto-generated name
      expect(nameField).toHaveTextContent('Uptime check for example.com/with-path');

      // Manually edit the name
      await userEvent.click(nameField);
      const nameInput = screen.getByRole('textbox', {name: 'Monitor Name'});
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'My Custom Name{Enter}');

      await screen.findByText('My Custom Name');

      // Change the URL - name should NOT update anymore
      urlInput = screen.getByRole('textbox', {name: 'URL'});
      await userEvent.clear(urlInput);
      await userEvent.type(urlInput, 'https://different-site.com');

      // Verify the name didn't change
      expect(screen.getByText('My Custom Name')).toBeInTheDocument();
      expect(
        screen.queryByText('Uptime check for different-site.com')
      ).not.toBeInTheDocument();
    });
  });

  describe('Cron Detector', () => {
    const cronRouterConfig = {
      ...initialRouterConfig,
      location: {
        ...initialRouterConfig.location,
        query: {detectorType: 'monitor_check_in_failure', project: project.id},
      },
    };

    it('submits default cron config with no changes', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: CronDetectorFixture({id: '999'}),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: cronRouterConfig,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalled();
      });

      expect(mockCreateDetector).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/detectors/`,
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'monitor_check_in_failure',
            name: 'New Monitor',
            projectId: project.id,
            workflowIds: [],
            dataSources: expect.arrayContaining([
              expect.objectContaining({
                name: 'New Monitor',
                config: expect.objectContaining({
                  schedule: '0 0 * * *',
                  schedule_type: 'crontab',
                  timezone: 'UTC',
                  checkin_margin: 1,
                  failure_issue_threshold: 1,
                  max_runtime: 30,
                  recovery_threshold: 1,
                }),
              }),
            ]),
          }),
        })
      );
    });

    it('submits crons config with changes', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/`,
        method: 'POST',
        body: CronDetectorFixture({id: '999'}),
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: cronRouterConfig,
      });

      const description = screen.getByRole('textbox', {name: 'description'});
      await userEvent.type(description, 'This is my cron monitor description');

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalled();
      });

      expect(mockCreateDetector).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/detectors/`,
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'monitor_check_in_failure',
            name: 'New Monitor',
            description: 'This is my cron monitor description',
          }),
        })
      );
    });
  });
});
