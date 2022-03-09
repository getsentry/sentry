import selectEvent from 'react-select-event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  mountWithTheme,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {metric} from 'sentry/utils/analytics';
import RuleFormContainer from 'sentry/views/alerts/incidentRules/ruleForm';

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
  const {organization, project, routerContext} = initializeOrg({
    organization: {features: ['metric-alert-threshold-period', 'change-alerts']},
  });
  const createWrapper = props =>
    mountWithTheme(
      <RuleFormContainer
        params={{orgId: organization.slug, projectId: project.slug}}
        organization={organization}
        project={project}
        {...props}
      />,
      {context: routerContext}
    );

  beforeEach(() => {
    MockApiClient.clearMockResponses();
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
      body: TestStubs.EventsStats(),
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

  describe('Creating a new rule', () => {
    let createRule;
    beforeEach(() => {
      createRule = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/alert-rules/',
        method: 'POST',
      });
      metric.startTransaction.mockClear();
    });

    /**
     * Note this isn't necessarily the desired behavior, as it is just documenting the behavior
     */
    it('creates a rule', async () => {
      const rule = TestStubs.IncidentRule();
      createWrapper({
        rule: {
          ...rule,
          id: undefined,
          eventTypes: ['default'],
        },
      });

      // Clear field
      userEvent.clear(screen.getByPlaceholderText('Something really bad happened'));

      // Enter in name so we can submit
      userEvent.type(
        screen.getByPlaceholderText('Something really bad happened'),
        'Incident Rule'
      );

      // Set thresholdPeriod
      await selectEvent.select(screen.getAllByText('For 1 minute')[0], 'For 10 minutes');

      userEvent.click(screen.getByLabelText('Save Rule'));

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
  });

  describe('Editing a rule', () => {
    let editRule;
    let editTrigger;
    const rule = TestStubs.IncidentRule();

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

    it('edits metric', () => {
      createWrapper({
        ruleId: rule.id,
        rule,
      });

      // Clear field
      userEvent.clear(screen.getByPlaceholderText('Something really bad happened'));

      userEvent.type(
        screen.getByPlaceholderText('Something really bad happened'),
        'new name'
      );

      userEvent.click(screen.getByLabelText('Save Rule'));

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

      expect(screen.getByLabelText('Select Percent Change')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Percent Change')).toBeChecked();

      userEvent.click(screen.getByLabelText('Select Count'));
      await waitFor(() => expect(screen.getByLabelText('Select Count')).toBeChecked());

      userEvent.click(screen.getByLabelText('Save Rule'));

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
      const alertRule = TestStubs.IncidentRule({name: 'Slack Alert Rule'});
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

      userEvent.type(
        screen.getByPlaceholderText('Something really bad happened'),
        'Slack Alert Rule'
      );
      userEvent.click(screen.getByLabelText('Save Rule'));

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
      const alertRule = TestStubs.IncidentRule({name: 'Slack Alert Rule'});
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
      const alertRule = TestStubs.IncidentRule({name: 'Slack Alert Rule'});
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
      userEvent.type(
        screen.getByPlaceholderText('Something really bad happened'),
        'Slack Alert Rule'
      );
      userEvent.click(screen.getByLabelText('Save Rule'));

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
