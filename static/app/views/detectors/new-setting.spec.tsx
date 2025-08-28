import {AutomationFixture} from 'sentry-fixture/automations';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
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
                aggregate: 'avg(span.duration)',
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
  });
});
