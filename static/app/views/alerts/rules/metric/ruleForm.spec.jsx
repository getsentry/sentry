import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {metric} from 'sentry/utils/analytics';
import RuleFormContainer from 'sentry/views/alerts/rules/metric/ruleForm';

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
  let organization, project, routerContext;
  const createWrapper = props =>
    render(
      <RuleFormContainer
        params={{orgId: organization.slug, projectId: project.slug}}
        organization={organization}
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
      body: TestStubs.EventsStats({
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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  describe('Creating a new rule', () => {
    let createRule;
    beforeEach(() => {
      createRule = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/alert-rules/',
        method: 'POST',
      });
    });

    /**
     * Note this isn't necessarily the desired behavior, as it is just documenting the behavior
     */
    it('creates a rule', async () => {
      const rule = TestStubs.MetricRule();
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
      await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'Incident Rule');

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

    it('creates a rule with generic_metrics dataset', async () => {
      organization.features = [...organization.features, 'mep-rollout-flag'];
      const rule = TestStubs.MetricRule();
      createWrapper({
        rule: {
          ...rule,
          id: undefined,
          aggregate: 'count()',
          eventTypes: ['transaction'],
          dataset: 'transactions',
        },
      });

      await waitFor(() =>
        expect(screen.getByTestId('alert-total-events')).toHaveTextContent(
          'Total Events5'
        )
      );

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
      const rule = TestStubs.MetricRule();
      createWrapper({
        rule: {
          ...rule,
          id: undefined,
          eventTypes: ['default'],
        },
      });

      await userEvent.click(screen.getAllByText('Number of Errors').at(1));
      await userEvent.click(await screen.findByText('Custom Metric'));

      await userEvent.click(screen.getAllByText('event.type:transaction').at(1));
      await userEvent.click(await screen.findByText('event.type:error'));
      expect(screen.getAllByText('Custom Metric')).toHaveLength(2);
      await userEvent.click(screen.getByLabelText('Save Rule'));

      expect(createRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            aggregate: 'count()',
            alertType: 'custom',
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
    const rule = TestStubs.MetricRule();

    beforeEach(() => {
      editRule = MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/alert-rules/${rule.id}/`,
        method: 'PUT',
        body: rule,
      });
      editTrigger = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/alert-rules/${rule.id}/triggers/1/`,
        method: 'PUT',
        body: TestStubs.IncidentTrigger({id: 1}),
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

      await userEvent.paste(screen.getByPlaceholderText('Enter Alert Name'), 'new name');

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
      const alertRule = TestStubs.MetricRule({name: 'Slack Alert Rule'});
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/alert-rules/${alertRule.id}/`,
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

      await userEvent.paste(
        screen.getByPlaceholderText('Enter Alert Name'),
        'Slack Alert Rule'
      );
      await userEvent.click(screen.getByLabelText('Save Rule'));

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

    it('pending status keeps loading true', async () => {
      const alertRule = TestStubs.MetricRule({name: 'Slack Alert Rule'});
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/alert-rules/${alertRule.id}/`,
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
      const alertRule = TestStubs.MetricRule({name: 'Slack Alert Rule'});
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/alert-rules/${alertRule.id}/`,
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
      await userEvent.paste(
        screen.getByPlaceholderText('Enter Alert Name'),
        'Slack Alert Rule'
      );
      await userEvent.click(screen.getByLabelText('Save Rule'));

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
