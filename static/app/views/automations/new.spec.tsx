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
          integrations: [{id: '1', name: 'My Slack Workspace'}],
        }),
        ActionHandlerFixture({
          type: ActionType.EMAIL,
          handlerGroup: ActionGroup.NOTIFICATION,
          integrations: [],
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
                logicType: 'any-short',
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
                      targetIdentifier: null,
                      targetDisplay: '#alerts',
                    },
                    integrationId: '1',
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
});
