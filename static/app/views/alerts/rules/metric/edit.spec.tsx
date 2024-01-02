import {Member as MemberFixture} from 'sentry-fixture/member';
import {MetricRule as MetricRuleFixture} from 'sentry-fixture/metricRule';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {metric} from 'sentry/utils/analytics';
import MetricRulesEdit from 'sentry/views/alerts/rules/metric/edit';
import {AlertRuleTriggerType} from 'sentry/views/alerts/rules/metric/types';

jest.mock('sentry/utils/analytics', () => ({
  metric: {
    startTransaction: jest.fn(() => ({
      setTag: jest.fn(),
      setData: jest.fn(),
    })),
    mark: jest.fn(),
    measure: jest.fn(),
    endTransaction: jest.fn(),
  },
}));

describe('MetricRulesEdit', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: null,
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
      url: '/organizations/org-slug/members/',
      body: [MemberFixture()],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders and edits trigger', async function () {
    const {organization, project} = initializeOrg();
    const rule = MetricRuleFixture();
    const onChangeTitleMock = jest.fn();
    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    const editRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      method: 'PUT',
      body: rule,
    });

    render(
      <MetricRulesEdit
        {...RouteComponentPropsFixture()}
        params={{
          projectId: project.slug,
          ruleId: rule.id!,
        }}
        userTeamIds={[]}
        organization={organization}
        onChangeTitle={onChangeTitleMock}
        project={project}
      />
    );

    // has existing trigger
    expect(screen.getByTestId('critical-threshold')).toHaveValue('70');
    expect(screen.getByTestId('resolve-threshold')).toHaveValue('36');

    expect(req).toHaveBeenCalled();

    // Check correct rule name is called
    expect(onChangeTitleMock).toHaveBeenCalledWith(rule.name);

    await userEvent.clear(screen.getByTestId('resolve-threshold'));
    await userEvent.type(screen.getByTestId('resolve-threshold'), '7');

    // Create a new action
    await userEvent.click(screen.getByLabelText('Add Action'));

    // Save Trigger
    await userEvent.click(screen.getByLabelText('Save Rule'));

    expect(metric.startTransaction).toHaveBeenCalledWith({name: 'saveAlertRule'});

    expect(editRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          dataset: 'events',
          id: '4',
          name: 'My Incident Rule',
          projects: ['project-slug'],
          query: '',
          status: 0,
          timeWindow: 60,
          thresholdType: 0,
          resolveThreshold: 7,
          triggers: [
            expect.objectContaining({
              actions: [
                expect.objectContaining({
                  integrationId: null,
                  targetIdentifier: '',
                  targetType: 'user',
                  type: 'email',
                  options: null,
                }),
              ],
              alertRuleId: '4',
              alertThreshold: 70,
              id: '1',
            }),
          ],
        }),
        method: 'PUT',
      })
    );

    // New Trigger should be in list
    // Has correct values
    expect(screen.getByTestId('critical-threshold')).toHaveValue('70');
    expect(screen.getByTestId('resolve-threshold')).toHaveValue('7');
  });

  it('removes warning trigger', async function () {
    const {organization, project} = initializeOrg();
    const rule = MetricRuleFixture();
    rule.triggers.push({
      label: AlertRuleTriggerType.WARNING,
      alertThreshold: 13,
      actions: [],
    });
    rule.resolveThreshold = 12;

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });

    const editRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      method: 'PUT',
      body: rule,
    });

    render(
      <MetricRulesEdit
        {...RouteComponentPropsFixture()}
        params={{
          projectId: project.slug,
          ruleId: rule.id!,
        }}
        userTeamIds={[]}
        organization={organization}
        onChangeTitle={() => {}}
        project={project}
      />
    );

    // has existing trigger
    expect(screen.getByTestId('critical-threshold')).toHaveValue('70');
    expect(screen.getByTestId('warning-threshold')).toHaveValue('13');
    expect(screen.getByTestId('resolve-threshold')).toHaveValue('12');

    // Clear warning Trigger
    await userEvent.clear(screen.getByTestId('warning-threshold'));

    await userEvent.click(screen.getByLabelText('Save Rule'));

    expect(editRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          dataset: 'events',
          id: '4',
          name: 'My Incident Rule',
          projects: ['project-slug'],
          query: '',
          status: 0,
          timeWindow: 60,
          resolveThreshold: 12,
          thresholdType: 0,
          triggers: [
            expect.objectContaining({
              actions: [],
              alertRuleId: '4',
              alertThreshold: 70,
              id: '1',
            }),
          ],
        }),
        method: 'PUT',
      })
    );
  });

  it('renders 404', function () {
    const {organization, project} = initializeOrg();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/1234/`,
      statusCode: 404,
      body: {},
    });

    render(
      <MetricRulesEdit
        {...RouteComponentPropsFixture()}
        userTeamIds={[]}
        onChangeTitle={() => {}}
        params={{
          projectId: project.slug,
          ruleId: '1234',
        }}
        organization={organization}
        project={project}
      />
    );

    expect(screen.getByText('This alert rule could not be found.')).toBeInTheDocument();
  });
});
