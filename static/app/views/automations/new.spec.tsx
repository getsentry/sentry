import {AutomationFixture} from 'sentry-fixture/automations';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';
import {
  ActionHandlerFixture,
  DataConditionHandlerFixture,
} from 'sentry-fixture/workflowEngine';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {Action} from 'sentry/types/workflowEngine/actions';
import {ActionGroup, ActionType} from 'sentry/types/workflowEngine/actions';
import {
  DataConditionHandlerGroupType,
  DataConditionHandlerSubgroupType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {trackAnalytics} from 'sentry/utils/analytics';
import AutomationNewSettings from 'sentry/views/automations/new';

jest.mock('sentry/utils/analytics');

describe('AutomationNewSettings', () => {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});
  const mockMember = MemberFixture({
    user: UserFixture({id: '1', name: 'Moo Deng', email: 'moo.deng@sentry.io'}),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();

    // Available actions (include Slack with a default integration)
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      method: 'GET',
      body: [
        ActionHandlerFixture({
          type: ActionType.SLACK,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [{id: 'slack-1', name: 'My Slack Workspace'}],
        }),
        ActionHandlerFixture({
          type: ActionType.EMAIL,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: undefined,
        }),
        ActionHandlerFixture({
          type: ActionType.DISCORD,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [{id: 'discord-1', name: 'My Discord Server'}],
        }),
        ActionHandlerFixture({
          type: ActionType.MSTEAMS,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [{id: 'msteams-1', name: 'My MS Teams'}],
        }),
        ActionHandlerFixture({
          type: ActionType.PAGERDUTY,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [
            {
              id: 'pagerduty-1',
              name: 'My PagerDuty',
              services: [{id: 'pd-service-1', name: 'PD Service'}],
            },
          ],
        }),
        ActionHandlerFixture({
          type: ActionType.OPSGENIE,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [
            {
              id: 'opsgenie-1',
              name: 'My Opsgenie',
              services: [{id: 'og-team-1', name: 'Ops Team'}],
            },
          ],
        }),
        ActionHandlerFixture({
          type: ActionType.WEBHOOK,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [],
          services: [{slug: 'webhook-service', name: 'Webhook Service'}],
        }),
        ActionHandlerFixture({
          type: ActionType.SENTRY_APP,
          handlerGroup: ActionGroup.OTHER,
          integrations: [],
          sentryApp: {
            id: 'sentry-app-1',
            installationId: 'installation-id',
            installationUuid: 'installation-uuid',
            name: 'My Sentry App',
            status: 0,
          },
        }),
        ActionHandlerFixture({
          type: ActionType.GITHUB,
          handlerGroup: ActionGroup.TICKET_CREATION,
          integrations: [{id: 'github-1', name: 'GitHub Org'}],
        }),
        ActionHandlerFixture({
          type: ActionType.GITHUB_ENTERPRISE,
          handlerGroup: ActionGroup.TICKET_CREATION,
          integrations: [{id: 'github-enterprise-1', name: 'GitHub Enterprise'}],
        }),
        ActionHandlerFixture({
          type: ActionType.JIRA,
          handlerGroup: ActionGroup.TICKET_CREATION,
          integrations: [{id: 'jira-1', name: 'Jira Cloud'}],
        }),
        ActionHandlerFixture({
          type: ActionType.JIRA_SERVER,
          handlerGroup: ActionGroup.TICKET_CREATION,
          integrations: [{id: 'jira-server-1', name: 'Jira Server'}],
        }),
        ActionHandlerFixture({
          type: ActionType.AZURE_DEVOPS,
          handlerGroup: ActionGroup.TICKET_CREATION,
          integrations: [{id: 'azure-1', name: 'Azure DevOps'}],
        }),
        ActionHandlerFixture({
          type: ActionType.PLUGIN,
          handlerGroup: ActionGroup.OTHER,
          integrations: undefined,
        }),
      ],
    });

    // Mock the tags for an organization
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-conditions/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({group: DataConditionHandlerGroupType.ACTION_FILTER}),
      ],
      body: [
        DataConditionHandlerFixture({
          handlerGroup: DataConditionHandlerGroupType.ACTION_FILTER,
          handlerSubgroup: DataConditionHandlerSubgroupType.ISSUE_ATTRIBUTES,
          type: DataConditionType.TAGGED_EVENT,
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-conditions/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({group: DataConditionHandlerGroupType.WORKFLOW_TRIGGER}),
      ],
      body: [
        DataConditionHandlerFixture({
          handlerGroup: DataConditionHandlerGroupType.WORKFLOW_TRIGGER,
        }),
      ],
    });

    // Users/members endpoints fetched by AutomationBuilder for member selectors
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      method: 'GET',
      body: [mockMember],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      method: 'GET',
      body: [mockMember],
    });

    // Detectors list used by EditConnectedMonitors inside the form
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      method: 'GET',
      body: [],
    });

    // Projects for EnvironmentSelector
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [],
    });
  });

  it('creates an automation from scratch and submits successfully', async () => {
    const created = AutomationFixture({id: '123', name: 'New Automation'});
    const post = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      method: 'POST',
      body: created,
    });

    const {router} = render(<AutomationNewSettings />, {organization});

    // Add an action filter (tagged event)
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Add filter'}),
      /tagged event/i
    );
    const tagInput = await screen.findByRole('textbox', {name: 'Tag'});
    await userEvent.type(tagInput, 'env{enter}');
    await userEvent.type(screen.getByRole('textbox', {name: 'Value'}), 'prod');

    // Add an action to the block (Slack), also updates the automatic naming
    await selectEvent.select(screen.getByRole('textbox', {name: 'Add action'}), 'Slack');
    await userEvent.type(screen.getByRole('textbox', {name: 'Target'}), '#alerts');

    // Add an email action
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Add action'}),
      'Notify on preferred channel'
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Notification target type'}),
      'Member'
    );
    await selectEvent.select(screen.getByRole('textbox', {name: 'User'}), 'Moo Deng');

    // Submit the form
    await userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'Notify #alerts via Slack, Notify Moo Deng',
            triggers: {
              logicType: 'any-short',
              conditions: [
                {type: 'first_seen_event', comparison: true, conditionResult: true},
                {type: 'issue_resolved_trigger', comparison: true, conditionResult: true},
                {type: 'reappeared_event', comparison: true, conditionResult: true},
                {type: 'regression_event', comparison: true, conditionResult: true},
              ],
              actions: [],
            },
            environment: null,
            actionFilters: [
              {
                logicType: 'all',
                conditions: [
                  {
                    type: 'tagged_event',
                    comparison: {match: 'co', key: 'env', value: 'prod'},
                    conditionResult: true,
                  },
                ],
                actions: [
                  {
                    type: 'slack',
                    config: {
                      targetType: 'specific',
                      targetIdentifier: '',
                      targetDisplay: '#alerts',
                    },
                    integrationId: 'slack-1',
                    data: {},
                    status: 'active',
                  },
                  {
                    type: 'email',
                    config: {
                      targetType: 'user',
                      targetIdentifier: '1',
                      targetDisplay: null,
                    },
                    data: {},
                    status: 'active',
                  },
                ],
              },
            ],
            config: {frequency: 1440},
            detectorIds: [],
            enabled: true,
          },
        })
      )
    );

    // Assert navigation to details page
    await waitFor(() =>
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/monitors/alerts/${created.id}/`
      )
    );

    // Verify analytics was called with correct event and payload structure
    expect(trackAnalytics).toHaveBeenCalledWith('automation.created', {
      organization,
      frequency_minutes: expect.any(Number),
      environment: null,
      detectors_count: expect.any(Number),
      trigger_conditions_count: expect.any(Number),
      success: true,
      actions_count: expect.any(Number),
      source: 'full',
    });
  });

  it('submits correct payloads for each action type', async () => {
    const created = AutomationFixture({
      id: '456',
      name: 'Automation with every action type',
    });
    const saveWorkflow = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      method: 'POST',
      body: created,
    });

    render(<AutomationNewSettings />, {organization});

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Add filter'}),
      /tagged event/i
    );
    const tagInput = await screen.findByRole('textbox', {name: 'Tag'});
    await userEvent.type(tagInput, 'env{enter}');
    await userEvent.type(screen.getByRole('textbox', {name: 'Value'}), 'prod');

    const addAction = async (label: string) => {
      await selectEvent.select(screen.getByRole('textbox', {name: 'Add action'}), label);
    };

    await addAction('Slack');
    await userEvent.type(screen.getByRole('textbox', {name: 'Target'}), '#alerts');

    await addAction('Discord');
    await userEvent.type(screen.getByPlaceholderText('channel ID or URL'), '123');

    await addAction('MS Teams');
    const targets = screen.getAllByRole('textbox', {name: 'Target'});
    const msTeamsTarget = targets.at(-1);
    expect(msTeamsTarget).toBeDefined();
    await userEvent.type(msTeamsTarget as HTMLElement, 'alerts-team');

    await addAction('Pagerduty');
    await addAction('Opsgenie');

    await addAction('Notify on preferred channel');
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Notification target type'}),
      'Member'
    );
    await selectEvent.select(screen.getByRole('textbox', {name: 'User'}), 'Moo Deng');

    await addAction('Send a notification via an integration');
    await addAction('My Sentry App');
    await addAction('GitHub');
    await addAction('GitHub Enterprise');
    await addAction('Jira');
    await addAction('Jira Server');
    await addAction('Azure DevOps');
    await addAction('Legacy integrations');

    await userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));

    const EXPECTED_ACTION_PAYLOADS: Record<ActionType, any> = {
      slack: {
        type: 'slack',
        integrationId: 'slack-1',
        config: {
          targetType: 'specific',
          targetIdentifier: '',
          targetDisplay: '#alerts',
        },
      },
      discord: {
        type: 'discord',
        integrationId: 'discord-1',
        config: {
          targetType: 'specific',
          targetIdentifier: '123',
          targetDisplay: null,
        },
      },
      msteams: {
        type: 'msteams',
        integrationId: 'msteams-1',
        config: {
          targetType: 'specific',
          targetIdentifier: '',
          targetDisplay: 'alerts-team',
        },
      },
      pagerduty: {
        type: 'pagerduty',
        integrationId: 'pagerduty-1',
        config: {
          targetType: 'specific',
          targetIdentifier: 'pd-service-1',
          targetDisplay: 'PD Service',
        },
        data: {priority: 'default'},
      },
      opsgenie: {
        type: 'opsgenie',
        integrationId: 'opsgenie-1',
        config: {
          targetType: 'specific',
          targetIdentifier: 'og-team-1',
          targetDisplay: 'Ops Team',
        },
        data: {priority: 'P1'},
      },
      email: {
        type: 'email',
        config: {
          targetType: 'user',
          targetIdentifier: '1',
          targetDisplay: null,
        },
        data: {},
      },
      webhook: {
        type: 'webhook',
        config: {
          targetType: null,
          targetIdentifier: 'webhook-service',
          targetDisplay: null,
        },
      },
      sentry_app: {
        type: 'sentry_app',
        config: {
          targetType: 'sentry_app',
          targetIdentifier: 'sentry-app-1',
          targetDisplay: 'My Sentry App',
          sentryAppIdentifier: 'sentry_app_id',
        },
      },
      github: {
        type: 'github',
        integrationId: 'github-1',
        config: {
          targetType: 'specific',
          targetIdentifier: null,
          targetDisplay: null,
        },
      },
      github_enterprise: {
        type: 'github_enterprise',
        integrationId: 'github-enterprise-1',
        config: {
          targetType: 'specific',
          targetIdentifier: null,
          targetDisplay: null,
        },
      },
      jira: {
        type: 'jira',
        integrationId: 'jira-1',
        config: {
          targetType: 'specific',
          targetIdentifier: null,
          targetDisplay: null,
        },
      },
      jira_server: {
        type: 'jira_server',
        integrationId: 'jira-server-1',
        config: {
          targetType: 'specific',
          targetIdentifier: null,
          targetDisplay: null,
        },
      },
      vsts: {
        type: 'vsts',
        integrationId: 'azure-1',
        config: {
          targetType: 'specific',
          targetIdentifier: null,
          targetDisplay: null,
        },
      },
      plugin: {
        type: 'plugin',
        config: {
          targetType: null,
          targetIdentifier: '',
          targetDisplay: null,
        },
      },
    };

    await waitFor(() => expect(saveWorkflow).toHaveBeenCalled());
    const actionsData: Action[] =
      saveWorkflow.mock.calls[0]?.[1]?.data?.actionFilters?.[0]?.actions ?? [];
    expect(actionsData).toHaveLength(Object.keys(EXPECTED_ACTION_PAYLOADS).length);

    actionsData.forEach(action => {
      const expectedAction = EXPECTED_ACTION_PAYLOADS[action.type];
      expect(expectedAction).toBeDefined();
      expect(action).toEqual(expect.objectContaining(expectedAction));
    });
  });
});
