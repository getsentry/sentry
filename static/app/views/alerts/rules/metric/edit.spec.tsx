import {MemberFixture} from 'sentry-fixture/member';
import {MetricRuleFixture} from 'sentry-fixture/metricRule';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {metric} from 'sentry/utils/analytics';
import {MetricRulesEdit} from 'sentry/views/alerts/rules/metric/edit';
import {
  AlertRuleTriggerType,
  Dataset,
  EventTypes,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

jest.mock('sentry/utils/analytics', () => ({
  metric: {
    startSpan: jest.fn(() => ({
      setTag: jest.fn(),
      setData: jest.fn(),
    })),
    mark: jest.fn(),
    measure: jest.fn(),
    endSpan: jest.fn(),
  },
}));

describe('MetricRulesEdit', () => {
  beforeEach(() => {
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders and edits trigger', async () => {
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
          ruleId: rule.id,
        }}
        userTeamIds={[]}
        organization={organization}
        onChangeTitle={onChangeTitleMock}
        project={project}
      />
    );

    // has existing trigger
    expect(await screen.findByTestId('critical-threshold')).toHaveValue('70');
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

    expect(metric.startSpan).toHaveBeenCalledWith({name: 'saveAlertRule'});

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

  it('removes warning trigger', async () => {
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
          ruleId: rule.id,
        }}
        userTeamIds={[]}
        organization={organization}
        onChangeTitle={() => {}}
        project={project}
      />
    );

    // has existing trigger
    expect(await screen.findByTestId('critical-threshold')).toHaveValue('70');
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

  it('renders 404', async () => {
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

    expect(
      await screen.findByText('This alert rule could not be found.')
    ).toBeInTheDocument();
  });

  it('changes SERVER_WEIGHTED extrapolation mode to CLIENT_AND_SERVER_WEIGHTED when editing and saving', async () => {
    const {organization, project} = initializeOrg();
    const ruleWithExtrapolation = MetricRuleFixture({
      id: '5',
      name: 'Alert Rule with Extrapolation',
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
      aggregate: 'count()',
      query: '',
      eventTypes: [EventTypes.TRACE_ITEM_SPAN],
      extrapolationMode: ExtrapolationMode.SERVER_WEIGHTED,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${ruleWithExtrapolation.id}/`,
      body: ruleWithExtrapolation,
    });

    const eventsStatsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: null,
    });

    const editRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${ruleWithExtrapolation.id}/`,
      method: 'PUT',
      body: ruleWithExtrapolation,
    });

    render(
      <MetricRulesEdit
        {...RouteComponentPropsFixture()}
        params={{
          projectId: project.slug,
          ruleId: ruleWithExtrapolation.id,
        }}
        userTeamIds={[]}
        organization={organization}
        onChangeTitle={() => {}}
        project={project}
      />
    );

    // Wait for the rule to load
    expect(await screen.findByTestId('critical-threshold')).toBeInTheDocument();

    // Verify events-stats is called with 'serverOnly' extrapolation mode for the chart
    expect(eventsStatsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          extrapolationMode: 'sampleWeighted',
          sampling: SAMPLING_MODE.NORMAL,
        }),
      })
    );

    // Make a change to the threshold
    await userEvent.clear(screen.getByTestId('resolve-threshold'));
    await userEvent.type(screen.getByTestId('resolve-threshold'), '40');

    // Save the rule
    await userEvent.click(screen.getByLabelText('Save Rule'));

    // Verify the save request preserves the extrapolation mode
    expect(editRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          extrapolationMode: ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED,
        }),
        method: 'PUT',
      })
    );
  });

  it('changes NONE extrapolation mode to CLIENT_AND_SERVER_WEIGHTED when editing and saving', async () => {
    const {organization, project} = initializeOrg();
    const ruleWithNoExtrapolation = MetricRuleFixture({
      id: '6',
      name: 'Alert Rule with No Extrapolation',
      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
      aggregate: 'count()',
      query: '',
      eventTypes: [EventTypes.TRACE_ITEM_SPAN],
      extrapolationMode: ExtrapolationMode.NONE,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${ruleWithNoExtrapolation.id}/`,
      body: ruleWithNoExtrapolation,
    });

    const eventsStatsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: null,
    });

    const editRule = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${ruleWithNoExtrapolation.id}/`,
      method: 'PUT',
      body: ruleWithNoExtrapolation,
    });

    render(
      <MetricRulesEdit
        {...RouteComponentPropsFixture()}
        params={{
          projectId: project.slug,
          ruleId: ruleWithNoExtrapolation.id,
        }}
        userTeamIds={[]}
        organization={organization}
        onChangeTitle={() => {}}
        project={project}
      />
    );

    // Wait for the rule to load
    expect(await screen.findByTestId('critical-threshold')).toBeInTheDocument();

    // Verify events-stats is called with 'none' extrapolation mode for the chart
    expect(eventsStatsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          extrapolationMode: 'sampleWeighted',
          sampling: SAMPLING_MODE.NORMAL,
        }),
      })
    );

    // Make a change to the threshold
    await userEvent.clear(screen.getByTestId('resolve-threshold'));
    await userEvent.type(screen.getByTestId('resolve-threshold'), '50');

    // Save the rule
    await userEvent.click(screen.getByLabelText('Save Rule'));

    // Verify the save request preserves the extrapolation mode
    expect(editRule).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          extrapolationMode: ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED,
        }),
        method: 'PUT',
      })
    );
  });
});
