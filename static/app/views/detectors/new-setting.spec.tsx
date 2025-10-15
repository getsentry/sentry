import {AutomationFixture} from 'sentry-fixture/automations';
import {MetricDetectorFixture, UptimeDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import DetectorNewSettings from 'sentry/views/detectors/new-settings';

describe('DetectorEdit', () => {
  const organization = OrganizationFixture({
    features: ['workflow-engine-ui', 'visibility-explore-view'],
  });
  const project = ProjectFixture({organization, environments: ['production']});
  const initialRouterConfig = {
    route: '/organizations/:orgId/issues/monitors/new/settings/',
    location: {
      pathname: '/organizations/org-slug/issues/monitors/new/settings/',
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

      await userEvent.type(screen.getByRole('spinbutton', {name: 'Threshold'}), '100');

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
                ],
                logicType: 'any',
              },
              config: {
                detectionType: 'static',
                thresholdPeriod: 1,
              },
              dataSource: {
                aggregate: 'count(span.duration)',
                dataset: 'events_analytics_platform',
                eventTypes: ['trace_item_span'],
                query: '',
                queryType: 1,
                timeWindow: 3600,
                environment: null,
              },
            }),
          })
        );
      });

      // Should navigate to the new monitor page
      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/issues/monitors/123/`
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

      await userEvent.type(screen.getByRole('spinbutton', {name: 'Threshold'}), '100');

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'My Monitor',
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
                ],
                logicType: 'any',
              },
              config: {detectionType: 'static', thresholdPeriod: 1},
              dataSource: {
                aggregate: 'count_unique(tags[sentry:user])',
                dataset: 'events',
                environment: 'prod',
                eventTypes: ['error'],
                query: '',
                queryType: 0,
                timeWindow: 3600,
              },
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

      // Pick errors dataset
      await userEvent.click(screen.getByText('Spans'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Errors'}));

      await userEvent.type(screen.getByRole('spinbutton', {name: 'Threshold'}), '100');

      await userEvent.click(screen.getByLabelText('Add a search term'));
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
                conditions: [{comparison: 100, conditionResult: 75, type: 'gt'}],
                logicType: 'any',
              },
              config: {detectionType: 'static', thresholdPeriod: 1},
              dataSource: {
                aggregate: 'count()',
                dataset: 'events',
                environment: null,
                // Event type has moved from the query to the eventTypes field
                eventTypes: ['error'],
                query: '',
                queryType: 0,
                timeWindow: 3600,
              },
              name: 'Foo',
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
      await userEvent.type(screen.getByRole('spinbutton', {name: 'Threshold'}), '100');

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
                  type: 'lt',
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
      await userEvent.click(screen.getByText('Spans'));

      // Verify transactions option is not available for new detectors
      expect(
        screen.queryByRole('menuitemradio', {name: 'Transactions'})
      ).not.toBeInTheDocument();

      // Verify other datasets are still available
      expect(screen.getByRole('menuitemradio', {name: 'Errors'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Spans'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Releases'})).toBeInTheDocument();
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

      await userEvent.type(
        screen.getByRole('textbox', {name: 'URL'}),
        'https://uptime.example.com'
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
              downtimeThreshold: 3,
              environment: null,
              mode: 1,
              recoveryThreshold: 1,
            },
            dataSource: {
              intervalSeconds: 60,
              method: 'GET',
              timeoutMs: 5000,
              traceSampling: undefined,
              url: 'https://uptime.example.com',
            },
            name: 'New MonitorUptime Monitor',
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
              environment: null,
              mode: 1,
              recoveryThreshold: '4',
            },
            dataSource: {
              intervalSeconds: 60,
              method: 'GET',
              timeoutMs: 5000,
              traceSampling: undefined,
              url: 'https://uptime-custom.example.com',
            },
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
});
