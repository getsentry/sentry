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
import {AutomationBuilderDrawerForm} from 'sentry/views/automations/components/automationBuilderDrawerForm';

describe('AutomationBuilderDrawerForm', () => {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});
  const mockMember = MemberFixture({
    user: UserFixture({id: '1', name: 'Test User', email: 'test@sentry.io'}),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();

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

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [],
    });
  });

  it('creates automation successfully and calls onSuccess', async () => {
    const closeDrawer = jest.fn();
    const onSuccess = jest.fn();
    const createdAutomation = AutomationFixture({id: '123', name: 'Test Alert'});

    const postMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/workflows/`,
      method: 'POST',
      body: createdAutomation,
    });

    render(
      <AutomationBuilderDrawerForm
        closeDrawer={closeDrawer}
        onSuccess={onSuccess}
        connectedDetectorIds={['123']}
      />,
      {organization}
    );

    // Add an action
    await selectEvent.select(screen.getByRole('textbox', {name: 'Add action'}), 'Slack');
    await userEvent.type(screen.getByRole('textbox', {name: 'Target'}), '#alerts');

    // Fill in the automation name - clear first to override auto-generated name
    const nameInput = screen.getByRole('textbox', {name: 'Alert Name'});
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'My Test Alert');

    // Submit the form
    await userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            name: 'My Test Alert',
            detectorIds: ['123'],
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('123');
    });
  });
});
