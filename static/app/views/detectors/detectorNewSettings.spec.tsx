import {AutomationFixture} from 'sentry-fixture/automations';
import {
  CronDetectorFixture,
  MetricDetectorFixture,
  PreprodDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import DetectorNewSettings from 'sentry/views/detectors/detectorNewSettings';

describe('DetectorEdit', () => {
  const organization = OrganizationFixture({
    features: ['visibility-explore-view', 'performance-view'],
  });
  const organizationWithMonitorDuplication = OrganizationFixture({
    ...organization,
    features: [...organization.features, 'monitor-duplication'],
  });
  const project = ProjectFixture({
    organization,
    environments: ['production'],
  });
  const initialRouterConfig = {
    route: '/organizations/:orgId/monitors/new/settings/',
    location: {
      pathname: '/organizations/org-slug/monitors/new/settings/',
    },
  };

  function getDuplicateRouterConfig(detectorType: DetectorType, duplicateFrom: string) {
    return {
      ...initialRouterConfig,
      location: {
        ...initialRouterConfig.location,
        query: {detectorType, duplicateFrom, project: project.id},
      },
    };
  }

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
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-schedule-window/`,
      body: {start: 1700000000, end: 1700000001},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-schedule-buckets/`,
      body: [],
    });
  });

  it('selects the first project when an invalid project is provided in the URL', async () => {
    render(<DetectorNewSettings />, {
      organization,
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {detectorType: 'metric_issue', project: 'not-a-project-id'},
        },
      },
    });

    await screen.findByText('New Monitor');

    // Verify the project dropdown has the first project selected
    const projectSection = screen
      .getByText(/Choose the Project and Environment/)
      .closest('section')!;
    expect(within(projectSection).getByText(project.slug)).toBeInTheDocument();
  });

  it('allows a team admin to create a monitor for a writable project', async () => {
    const teamAdminOrganization = OrganizationFixture({
      ...organization,
      access: ['org:read', 'alerts:read'],
    });
    const readOnlyProject = ProjectFixture({
      id: '3',
      slug: 'read-only-project',
      organization: teamAdminOrganization,
      access: ['project:read', 'alerts:read'],
      isMember: true,
    });
    const writableProject = ProjectFixture({
      id: '4',
      slug: 'writable-project',
      organization: teamAdminOrganization,
      access: ['project:read', 'alerts:write'],
      isMember: true,
    });
    const otherWritableProject = ProjectFixture({
      id: '5',
      slug: 'other-writable-project',
      organization: teamAdminOrganization,
      access: ['project:read', 'alerts:write'],
      isMember: false,
    });
    ProjectsStore.loadInitialData([
      readOnlyProject,
      writableProject,
      otherWritableProject,
    ]);
    const mockCreateDetector = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/${writableProject.id}/detectors/`,
      method: 'POST',
      body: MetricDetectorFixture({id: '123', projectId: writableProject.id}),
    });

    render(<DetectorNewSettings />, {
      organization: teamAdminOrganization,
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {detectorType: 'metric_issue', project: readOnlyProject.id},
        },
      },
    });

    await screen.findByText('New Monitor');
    const projectSection = screen
      .getByText(/Choose the Project and Environment/)
      .closest('section')!;
    expect(within(projectSection).getByText(writableProject.slug)).toBeInTheDocument();

    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Select Project'}));
    expect(
      await screen.findByRole('menuitemradio', {
        name: otherWritableProject.slug,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: readOnlyProject.slug})
    ).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('spinbutton', {name: 'High threshold'}), '100');
    await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

    await waitFor(() => expect(mockCreateDetector).toHaveBeenCalled());
  });

  it('shows a permission error when no project is writable', () => {
    const readOnlyOrganization = OrganizationFixture({
      ...organization,
      access: ['org:read', 'alerts:read'],
    });
    ProjectsStore.loadInitialData([
      ProjectFixture({
        organization: readOnlyOrganization,
        access: ['project:read', 'alerts:read'],
      }),
    ]);

    render(<DetectorNewSettings />, {
      organization: readOnlyOrganization,
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {detectorType: 'metric_issue'},
        },
      },
    });

    expect(
      screen.getByText(/You do not have permission to create monitors/)
    ).toBeInTheDocument();
  });

  describe('Duplicate Detector', () => {
    it('rejects duplication when the feature is disabled', () => {
      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: getDuplicateRouterConfig('metric_issue', 'source-detector'),
      });

      expect(screen.getByText('This monitor cannot be duplicated.')).toBeVisible();
    });

    it('rejects mobile build duplication when mobile build monitors are disabled', () => {
      render(<DetectorNewSettings />, {
        organization: organizationWithMonitorDuplication,
        initialRouterConfig: getDuplicateRouterConfig(
          'preprod_size_analysis',
          'source-mobile-build'
        ),
      });

      expect(screen.getByText('This monitor cannot be duplicated.')).toBeVisible();
    });

    it('prefills and creates a metric detector copy', async () => {
      const sourceDetector = MetricDetectorFixture({
        id: 'source-detector',
        name: 'Checkout failures',
        projectId: project.id,
        description: 'Detects checkout failures',
        workflowIds: ['100'],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${sourceDetector.id}/`,
        body: sourceDetector,
      });
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: 'copied-detector'}),
      });

      const {router} = render(<DetectorNewSettings />, {
        organization: organizationWithMonitorDuplication,
        initialRouterConfig: getDuplicateRouterConfig(
          sourceDetector.type,
          sourceDetector.id
        ),
      });

      expect(
        await screen.findByRole('heading', {name: 'Checkout failures (Copy)'})
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox', {name: 'description'})).toHaveValue(
        'Detects checkout failures'
      );
      expect(screen.getByRole('button', {name: 'Cancel'})).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/monitors/${sourceDetector.id}/`
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Checkout failures (Copy)',
              description: 'Detects checkout failures',
              projectId: project.id,
              type: 'metric_issue',
              workflowIds: ['100'],
            }),
          })
        );
      });
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/monitors/copied-detector/`
      );
    });

    it('prefills a cron detector copy, including its schedule', async () => {
      const sourceDetector = CronDetectorFixture({
        id: 'source-cron',
        name: 'Nightly cleanup',
        projectId: project.id,
        workflowIds: ['100'],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${sourceDetector.id}/`,
        body: sourceDetector,
      });
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
        method: 'POST',
        body: CronDetectorFixture({id: 'copied-cron'}),
      });

      render(<DetectorNewSettings />, {
        organization: organizationWithMonitorDuplication,
        initialRouterConfig: getDuplicateRouterConfig(
          sourceDetector.type,
          sourceDetector.id
        ),
      });

      expect(
        await screen.findByRole('heading', {name: 'Nightly cleanup (Copy)'})
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Nightly cleanup (Copy)',
              workflowIds: ['100'],
              dataSources: [
                expect.objectContaining({
                  name: 'Nightly cleanup (Copy)',
                  config: expect.objectContaining({
                    schedule: '0 0 * * *',
                    schedule_type: 'crontab',
                  }),
                }),
              ],
            }),
          })
        );
      });
    });

    it('prefills and creates an uptime detector copy', async () => {
      const sourceDetector = UptimeDetectorFixture({
        id: 'source-uptime',
        name: 'Checkout uptime',
        projectId: project.id,
        workflowIds: ['100'],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${sourceDetector.id}/`,
        body: sourceDetector,
      });
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
        method: 'POST',
        body: UptimeDetectorFixture({id: 'copied-uptime'}),
      });

      render(<DetectorNewSettings />, {
        organization: organizationWithMonitorDuplication,
        initialRouterConfig: getDuplicateRouterConfig(
          sourceDetector.type,
          sourceDetector.id
        ),
      });

      expect(
        await screen.findByRole('heading', {name: 'Checkout uptime (Copy)'})
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Checkout uptime (Copy)',
              type: 'uptime_domain_failure',
              workflowIds: ['100'],
              dataSources: [
                expect.objectContaining({
                  url: 'https://example.com',
                }),
              ],
              config: expect.objectContaining({
                environment: 'production',
              }),
            }),
          })
        );
      });
    });

    it('prefills and creates a mobile build detector copy', async () => {
      const sourceDetector = PreprodDetectorFixture({
        id: 'source-mobile-build',
        name: 'iOS download size',
        projectId: project.id,
        workflowIds: ['100'],
        config: {
          measurement: 'download_size',
          thresholdType: 'relative_diff',
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${sourceDetector.id}/`,
        body: sourceDetector,
      });
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
        method: 'POST',
        body: PreprodDetectorFixture({id: 'copied-mobile-build'}),
      });

      render(<DetectorNewSettings />, {
        organization: OrganizationFixture({
          ...organizationWithMonitorDuplication,
          features: [
            ...organizationWithMonitorDuplication.features,
            'preprod-size-monitors-frontend',
          ],
        }),
        initialRouterConfig: getDuplicateRouterConfig(
          sourceDetector.type,
          sourceDetector.id
        ),
      });

      expect(
        await screen.findByRole('heading', {name: 'iOS download size (Copy)'})
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'iOS download size (Copy)',
              type: 'preprod_size_analysis',
              workflowIds: ['100'],
              config: expect.objectContaining({
                measurement: 'download_size',
                thresholdType: 'relative_diff',
              }),
            }),
          })
        );
      });
    });

    it('rejects a source monitor whose type does not match the create form', async () => {
      const sourceDetector = CronDetectorFixture({id: 'source-cron'});
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${sourceDetector.id}/`,
        body: sourceDetector,
      });

      render(<DetectorNewSettings />, {
        organization: organizationWithMonitorDuplication,
        initialRouterConfig: getDuplicateRouterConfig('metric_issue', sourceDetector.id),
      });

      expect(await screen.findByText('This monitor cannot be duplicated.')).toBeVisible();
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        features: ['visibility-explore-view', 'discover-saved-queries-deprecation'],
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
          `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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

  describe('Metric Detector with Metrics dataset', () => {
    it('shows metrics dataset option', async () => {
      const metricsOrganization = OrganizationFixture({
        features: ['visibility-explore-view', 'performance-view', 'tracemetrics-enabled'],
      });

      render(<DetectorNewSettings />, {
        organization: metricsOrganization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {detectorType: 'metric_issue', project: project.id},
          },
        },
      });

      await screen.findByText('New Monitor');

      // Open dataset dropdown
      await userEvent.click(screen.getByText('Errors'));

      expect(screen.getByRole('menuitemradio', {name: /Metrics/})).toBeInTheDocument();
    });

    it('auto-generates names using application metrics wording', () => {
      expect(
        getDatasetConfig(DetectorDataset.METRICS).formatAggregateForTitle?.('count()')
      ).toBe('Number of application metrics');
    });

    it('can submit a new metric detector with metrics dataset from URL params', async () => {
      const metricsOrganization = OrganizationFixture({
        features: ['visibility-explore-view', 'performance-view', 'tracemetrics-enabled'],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${metricsOrganization.slug}/events/`,
        body: {data: []},
      });

      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${metricsOrganization.slug}/projects/${project.id}/detectors/`,
        method: 'POST',
        body: MetricDetectorFixture({id: '999'}),
      });

      const {router} = render(<DetectorNewSettings />, {
        organization: metricsOrganization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {
              detectorType: 'metric_issue',
              project: project.id,
              dataset: 'metrics',
            },
          },
        },
      });

      const title = await screen.findByText('New Monitor');
      await userEvent.click(title);
      await userEvent.keyboard('Metrics Alert{enter}');

      await userEvent.type(
        screen.getByRole('spinbutton', {name: 'High threshold'}),
        '500'
      );

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalledWith(
          `/organizations/${metricsOrganization.slug}/projects/${project.id}/detectors/`,
          expect.objectContaining({
            data: expect.objectContaining({
              name: 'Metrics Alert',
              type: 'metric_issue',
              dataSources: [
                expect.objectContaining({
                  dataset: 'events_analytics_platform',
                  eventTypes: ['trace_item_metric'],
                  queryType: 1,
                }),
              ],
            }),
          })
        );
      });

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${metricsOrganization.slug}/monitors/999/`
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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

      // Change method to POST
      await selectEvent.select(screen.getByRole('textbox', {name: 'Method'}), 'POST');

      // Add headers
      const headerNameInput = screen.getByRole('textbox', {
        name: 'Name of header 1',
      });
      await userEvent.type(headerNameInput, 'X-API-Key');
      const headerValueInput = screen.getByRole('textbox', {
        name: 'Value of X-API-Key',
      });
      await userEvent.type(headerValueInput, 'secret-key-123');

      // Add body
      const bodyInput = screen.getByRole('textbox', {name: 'Body'});
      await userEvent.click(bodyInput);
      await userEvent.paste('{"test": "data"}');

      // Issue preview reflects the URL
      expect(
        screen.getByText('Downtime detected for uptime.example.com')
      ).toBeInTheDocument();

      await selectEvent.openMenu(screen.getByLabelText('Select Environment'));
      expect(
        screen.queryByRole('menuitemradio', {name: 'All Environments'})
      ).not.toBeInTheDocument();
      await selectEvent.select(screen.getByLabelText('Select Environment'), 'production');

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      await waitFor(() => {
        expect(mockCreateDetector).toHaveBeenCalled();
      });

      expect(mockCreateDetector).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
                assertion: {
                  root: {
                    id: expect.any(String),
                    op: 'and',
                    children: [
                      {
                        id: expect.any(String),
                        op: 'status_code_check',
                        operator: {cmp: 'greater_than'},
                        value: 199,
                      },
                      {
                        id: expect.any(String),
                        op: 'status_code_check',
                        operator: {cmp: 'less_than'},
                        value: 300,
                      },
                    ],
                  },
                },
                intervalSeconds: 60,
                method: 'POST',
                timeoutMs: 5000,
                traceSampling: undefined,
                url: 'https://uptime.example.com',
                headers: [['X-API-Key', 'secret-key-123']],
                body: '{"test": "data"}',
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
                assertion: {
                  root: {
                    id: expect.any(String),
                    op: 'and',
                    children: [
                      {
                        id: expect.any(String),
                        op: 'status_code_check',
                        operator: {cmp: 'greater_than'},
                        value: 199,
                      },
                      {
                        id: expect.any(String),
                        op: 'status_code_check',
                        operator: {cmp: 'less_than'},
                        value: 300,
                      },
                    ],
                  },
                },
                intervalSeconds: 60,
                method: 'GET',
                timeoutMs: 5000,
                traceSampling: undefined,
                url: 'https://uptime-custom.example.com',
                headers: [],
                body: null,
              },
            ],
            name: 'Uptime check for uptime-custom.example.com',
            projectId: '2',
            type: 'uptime_domain_failure',
          }),
        })
      );
    });
  });

  describe('Cron Detector', () => {
    const cronRouterConfig = {
      ...initialRouterConfig,
      location: {
        ...initialRouterConfig.location,
        query: {
          detectorType: 'monitor_check_in_failure',
          project: project.id,
        },
      },
    };

    it('submits default cron config with no changes', async () => {
      const mockCreateDetector = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
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
        `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'monitor_check_in_failure',
            name: 'New Monitor',
            description: 'This is my cron monitor description',
          }),
        })
      );
    });

    it('displays slug errors on the name field and in a toast', async () => {
      const errorMessage = 'The slug "new-test-cron-job" is already in use.';
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
        method: 'POST',
        statusCode: 400,
        body: {
          dataSources: {slug: [errorMessage]},
        },
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: cronRouterConfig,
      });

      const title = await screen.findByText('New Monitor');
      await userEvent.click(title);
      await userEvent.keyboard('new-test-cron-job{enter}');

      await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));

      // The slug error is mapped to the name field and also shown in a toast.
      expect(await screen.findAllByText(errorMessage)).toHaveLength(2);
      expect(
        within(screen.getByRole('region', {name: /Notifications/})).getByText(
          errorMessage
        )
      ).toBeInTheDocument();
    });

    it('displays schedule config errors on the schedule field and in a toast', async () => {
      const errorMessage = 'Invalid schedule for schedule unit count';
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/${project.id}/detectors/`,
        method: 'POST',
        statusCode: 400,
        body: {
          dataSources: {
            config: {schedule: [errorMessage]},
          },
        },
      });

      render(<DetectorNewSettings />, {
        organization,
        initialRouterConfig: cronRouterConfig,
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Create Monitor'}));

      expect(await screen.findAllByText(errorMessage)).toHaveLength(2);
      expect(
        within(screen.getByRole('region', {name: /Notifications/})).getByText(
          errorMessage
        )
      ).toBeInTheDocument();
    });
  });
});
