import {AutomationFixture} from 'sentry-fixture/automations';
import {OrganizationFixture} from 'sentry-fixture/organization';
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

  beforeEach(() => {
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
      ],
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

    // Users endpoint fetched by AutomationBuilder for member selectors
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      method: 'GET',
      body: [],
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
    await userEvent.type(screen.getByRole('textbox', {name: 'Tag'}), 'env');
    await userEvent.type(screen.getByRole('textbox', {name: 'Value'}), 'prod');

    // Add an action to the block (Slack), also updates the automatic naming
    await selectEvent.select(screen.getByRole('textbox', {name: 'Add action'}), 'Slack');
    await userEvent.type(screen.getByRole('textbox', {name: 'Target'}), '#alerts');

    // Submit the form
    await userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            name: 'Notify #alerts via Slack',
            triggers: {
              logicType: 'any-short',
              conditions: [
                {type: 'first_seen_event', comparison: true, conditionResult: true},
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
                      targetIdentifier: '',
                      targetDisplay: '#alerts',
                    },
                    integrationId: '1',
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
    await waitFor(() => {
      expect(trackAnalytics).toHaveBeenCalledWith('automation.created', {
        organization,
        frequency_minutes: expect.any(Number),
        environment: expect.anything(),
        detectors_count: expect.any(Number),
        trigger_conditions_count: expect.any(Number),
        actions_count: expect.any(Number),
      });
    });
  });
});
