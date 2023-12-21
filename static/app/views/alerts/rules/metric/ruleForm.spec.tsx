import selectEvent from 'react-select-event';
import {EventsStats} from 'sentry-fixture/events';
import {IncidentTrigger} from 'sentry-fixture/incidentTrigger';
import {MetricRule} from 'sentry-fixture/metricRule';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import FormModel from 'sentry/components/forms/model';
import ProjectsStore from 'sentry/stores/projectsStore';
import {metric} from 'sentry/utils/analytics';
import RuleFormContainer from 'sentry/views/alerts/rules/metric/ruleForm';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {permissionAlertText} from 'sentry/views/settings/project/permissionAlert';

jest.mock('sentry/actionCreators/indicator');
jest.mock('sentry/utils/analytics', () => ({
  metric: {
    startTransaction: jest.fn(() => ({
      setTag: jest.fn(),
      setData: jest.fn(),
    })),
    endTransaction: jest.fn(),
  },
}));

describe('Incident Rules Form', () => {
  let organization, project, routerContext, location;
  const createWrapper = props =>
    render(
      <RuleFormContainer
        params={{orgId: organization.slug, projectId: project.slug}}
        organization={organization}
        location={location}
        project={project}
        {...props}
      />,
      {context: routerContext}
    );

  beforeEach(() => {
    const initialData = initializeOrg({
      organization: {features: ['metric-alert-threshold-period', 'change-alerts']},
    });
    organization = initialData.organization;
    project = initialData.project;
    location = initialData.router.location;
    ProjectsStore.loadInitialData([project]);
    routerContext = initialData.routerContext;
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStats({
        isMetricsData: true,
      }),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {count: 5},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/available-actions/',
      body: [
        {
          allowedTargetTypes: ['user', 'team'],
          integrationName: null,
          type: 'email',
          integrationId: null,
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics-estimation-stats/',
      body: EventsStats(),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  describe('Viewing the rule', () => {
    const rule = MetricRule();

    it('is enabled without org-level alerts:write', () => {
      organization.access = [];
      project.access = [];
      createWrapper({rule});

      expect(screen.queryByText(permissionAlertText)).toBeInTheDocument();
      expect(screen.queryByLabelText('Save Rule')).toBeDisabled();
    });

    it('is enabled with org-level alerts:write', () => {
      organization.access = ['alerts:write'];
      project.access = [];
      createWrapper({rule});

      expect(screen.queryByText(permissionAlertText)).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Save Rule')).toBeEnabled();
    });

    it('is enabled with project-level alerts:write', () => {
      organization.access = [];
      project.access = ['alerts:write'];
      createWrapper({rule});

      expect(screen.queryByText(permissionAlertText)).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Save Rule')).toBeEnabled();
    });
  });

  describe('Creating a new rule', () => {
    let createRule;
    beforeEach(() => {
      ProjectsStore.loadInitialData([
        project,
        {
          ...project,
          id: '10',
          slug: 'project-slug-2',
        },
      ]);
      createRule = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/alert-rules/',
        method: 'POST',
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug-2/environments/',
        body: [],
      });
    });

    /**
     * Note this isn't necessarily the desired behavior, as it is just documenting the behavior
     */
    it('creates a rule', async () => {
      const rule = MetricRule();
      createWrapper({
        rule: {
          ...rule,
          id: undefined,
          eventTypes: ['default'],
        },
      });

      // Clear field
      await userEvent.clear(screen.getByPlaceholderText('Enter Alert Name'));

      // Enter in name so we can submit
      await userEvent.type(
        screen.getByPlaceholderText('Enter Alert Name'),
        'Incident Rule'
      );

      // Set thresholdPeriod
      await selectEvent.select(screen.getAllByText('For 1 minute')[0], 'For 10 minutes');

      await userEvent.click(screen.getByLabelText('Save Rule'));

      expect(createRule).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Incident Rule',
            projects: ['project-slug'],
            eventTypes: ['default'],
            thresholdPeriod: 10,
          }),
        })
      );
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });

    it('can create a rule for a different project', async () => {
      const rule = MetricRule();
      createWrapper({
        rule: {
          ...rule,
          id: undefined,
          eventTypes: ['default'],
        },
      });

      // Clear field
      await userEvent.clear(screen.getByPlaceholderText('Enter Alert Name'));

      // Enter in name so we can submit
      await userEvent.type(
        screen.getByPlaceholderText('Enter Alert Name'),
        'Incident Rule'
      );

      // Change project
      await userEvent.click(screen.getByText('project-slug'));
      await userEvent.click(screen.getByText('project-slug-2'));

      await userEvent.click(screen.getByLabelText('Save Rule'));

      expect(createRule).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Incident Rule',
            projects: ['project-slug-2'],
          }),
        })
      );
      expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});
    });

    it('creates a rule with generic_metrics dataset', async () => {
      organization.features = [...organization.features, 'mep-rollout-flag'];
      const rule = MetricRule();
      createWrapper({
        rule: {
          ...rule,
          id: undefined,
          aggregate: 'count()',
          eventTypes: ['transaction'],
          dataset: 'transactions',
        },
      });

      expect(await screen.findByTestId('alert-total-events')).toHaveTextContent('Total5');

      await userEvent.click(screen.getByLabelText('Save Rule'));

      expect(createRule).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'My Incident Rule',
            projects: ['project-slug'],
            aggregate: 'count()',
            eventTypes: ['transaction'],
            dataset: 'generic_metrics',
            thresholdPeriod: 1,
          }),
        })
      );
    });

    it('switches to custom metric and selects event.type:error', async () => {
      organization.features = [...organization.features, 'performance-view'];
      const rule = MetricRule();
      createWrapper({
        rule: {
          ...rule,
          id: undefined,
          eventTypes: ['default'],
        },
      });

      await userEvent.click(screen.getAllByText('Number of Errors').at(1)!);
      await userEvent.click(await screen.findByText('Custom Measurement'));

      await userEvent.click(screen.getAllByText('event.type:transaction').at(1)!);
      await userEvent.click(await screen.findByText('event.type:error'));
      expect(screen.getAllByText('Custom Measurement')).toHaveLength(2);
      await userEvent.click(screen.getByLabelText('Save Rule'));

      expect(createRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            aggregate: 'count()',
            alertType: 'custom_transactions',
            dataset: 'events',
            datasource: 'error',
            environment: null,
            eventTypes: ['error'],
            name: 'My Incident Rule',
            projectId: '2',
            projects: ['project-slug'],
            query: '',
          }),
        })
      );
    });
  });

  describe('Editing a rule', () => {
    let editRule;
    let editTrigger;
    const rule = MetricRule();

    beforeEach(() => {
      editRule = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/alert-rules/${rule.id}/`,
        method: 'PUT',
        body: rule,
      });
      editTrigger = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/alert-rules/${rule.id}/triggers/1/`,
        method: 'PUT',
        body: IncidentTrigger({id: '1'}),
      });
    });
    afterEach(() => {
      editRule.mockReset();
      editTrigger.mockReset();
    });

    it('edits metric', async () => {
      createWrapper({
        ruleId: rule.id,
        rule,
      });

      // Clear field
      await userEvent.clear(screen.getByPlaceholderText('Enter Alert Name'));

      await userEvent.type(screen.getByPlaceholderText('Enter Alert Name'), 'new name');

      await userEvent.click(screen.getByLabelText('Save Rule'));

      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new name',
          }),
        })
      );
    });

    it('switches from percent change to count', async () => {
      createWrapper({
        ruleId: rule.id,
        rule: {
          ...rule,
          timeWindow: 60,
          comparisonDelta: 100,
          eventTypes: ['error'],
          resolution: 2,
        },
      });

      expect(screen.getByLabelText('Static: above or below {x}')).not.toBeChecked();
      await userEvent.click(screen.getByText('Static: above or below {x}'));

      await waitFor(() =>
        expect(screen.getByLabelText('Static: above or below {x}')).toBeChecked()
      );

      await userEvent.click(screen.getByLabelText('Save Rule'));

      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            // Comparison delta is reset
            comparisonDelta: null,
          }),
        })
      );
    });

    it('switches event type from error to default', async () => {
      createWrapper({
        ruleId: rule.id,
        rule: {
          ...rule,
          eventTypes: ['error', 'default'],
        },
      });

      await userEvent.click(screen.getByText('event.type:error OR event.type:default'));
      await userEvent.click(await screen.findByText('event.type:default'));
      expect(screen.getAllByText('Number of Errors')).toHaveLength(2);
      await userEvent.click(screen.getByLabelText('Save Rule'));

      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            eventTypes: ['default'],
          }),
        })
      );
    });

    it('saves a valid on demand metric rule', async () => {
      const validOnDemandMetricRule = MetricRule({
        query: 'transaction.duration:<1s',
      });

      const onSubmitSuccess = jest.fn();

      createWrapper({
        ruleId: validOnDemandMetricRule.id,
        rule: {
          ...validOnDemandMetricRule,
          eventTypes: ['transaction'],
        },
        onSubmitSuccess,
      });

      await userEvent.click(screen.getByLabelText('Save Rule'), {delay: null});
      expect(onSubmitSuccess).toHaveBeenCalled();
    });

    it('hides fields when migrating error metric alerts to filter archived issues', async () => {
      const errorAlert = MetricRule({
        dataset: Dataset.ERRORS,
        query: 'example-error',
      });
      organization.features = [...organization.features, 'metric-alert-ignore-archived'];
      location = {...location, query: {migration: '1'}};

      const onSubmitSuccess = jest.fn();

      createWrapper({
        ruleId: errorAlert.id,
        rule: {
          ...errorAlert,
          eventTypes: ['transaction'],
        },
        onSubmitSuccess,
      });

      expect(
        await screen.findByText(/please make sure the current thresholds are still valid/)
      ).toBeInTheDocument();
      await userEvent.click(screen.getByLabelText('Looks good to me!'), {delay: null});
      expect(onSubmitSuccess).toHaveBeenCalled();
      const formModel = onSubmitSuccess.mock.calls[0][1] as FormModel;
      expect(formModel.getData()).toEqual(
        expect.objectContaining({query: 'is:unresolved example-error'})
      );
    });
  });

  describe('Slack async lookup', () => {
    const uuid = 'xxxx-xxxx-xxxx';

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('success status updates the rule', async () => {
      const alertRule = MetricRule({name: 'Slack Alert Rule'});
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/alert-rules/${alertRule.id}/`,
        method: 'PUT',
        body: {uuid},
        statusCode: 202,
      });
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/alert-rule-task/${uuid}/`,
        body: {
          status: 'success',
          alertRule,
        },
      });

      const onSubmitSuccess = jest.fn();
      createWrapper({
        ruleId: alertRule.id,
        rule: alertRule,
        onSubmitSuccess,
      });

      await userEvent.type(
        screen.getByPlaceholderText('Enter Alert Name'),
        'Slack Alert Rule',
        {delay: null}
      );
      await userEvent.click(screen.getByLabelText('Save Rule'), {delay: null});

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

      act(jest.runAllTimers);
      await waitFor(
        () => {
          expect(onSubmitSuccess).toHaveBeenCalledWith(
            expect.objectContaining({
              id: alertRule.id,
              name: alertRule.name,
            }),
            expect.anything()
          );
        },
        {timeout: 2000, interval: 10}
      );
    });

    it('pending status keeps loading true', () => {
      const alertRule = MetricRule({name: 'Slack Alert Rule'});
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/alert-rules/${alertRule.id}/`,
        method: 'PUT',
        body: {uuid},
        statusCode: 202,
      });
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/alert-rule-task/${uuid}/`,
        body: {
          status: 'pending',
        },
      });

      const onSubmitSuccess = jest.fn();
      createWrapper({
        ruleId: alertRule.id,
        rule: alertRule,
        onSubmitSuccess,
      });

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(onSubmitSuccess).not.toHaveBeenCalled();
    });

    it('failed status renders error message', async () => {
      const alertRule = MetricRule({name: 'Slack Alert Rule'});
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/alert-rules/${alertRule.id}/`,
        method: 'PUT',
        body: {uuid},
        statusCode: 202,
      });
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/alert-rule-task/${uuid}/`,
        body: {
          status: 'failed',
          error: 'An error occurred',
        },
      });

      const onSubmitSuccess = jest.fn();
      createWrapper({
        ruleId: alertRule.id,
        rule: alertRule,
        onSubmitSuccess,
      });
      await userEvent.type(
        screen.getByPlaceholderText('Enter Alert Name'),
        'Slack Alert Rule',
        {delay: null}
      );
      await userEvent.click(screen.getByLabelText('Save Rule'), {delay: null});

      act(jest.runAllTimers);
      await waitFor(
        () => {
          expect(addErrorMessage).toHaveBeenCalledWith('An error occurred');
        },
        {timeout: 2000, interval: 10}
      );
      expect(onSubmitSuccess).not.toHaveBeenCalled();
    });
  });
});
