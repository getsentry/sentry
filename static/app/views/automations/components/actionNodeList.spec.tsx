import {ActionFixture, DataConditionFixture} from 'sentry-fixture/automations';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ActionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {Form} from 'sentry/components/forms/form';
import {FormModel} from 'sentry/components/forms/model';
import {
  ActionGroup,
  ActionType,
  type ActionHandler,
} from 'sentry/types/workflowEngine/actions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  type DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';

import {AutomationFormProvider} from './forms/context';
import {ActionNodeList} from './actionNodeList';
import {AutomationBuilderTestProvider} from './testUtils';

const INCOMPATIBLE_MESSAGE =
  'This action is incompatible with the current configuration.';
const PARTIAL_SUPPORT_MESSAGE =
  'This action will fire for your other triggers, but not when an issue is resolved.';
const RESOLVED_WARNING = 'This action will not fire when an issue is resolved.';

function triggerGroup(
  types: DataConditionType[],
  logicType = DataConditionGroupLogicType.ANY_SHORT_CIRCUIT
): DataConditionGroup {
  return {
    id: 'triggers',
    conditions: types.map((type, index) =>
      DataConditionFixture({
        id: `condition-${index}`,
        type,
        comparison: true,
        conditionResult: true,
      })
    ),
    logicType,
  };
}

const slackActionHandler = ActionHandlerFixture();
const actionHandlers: ActionHandler[] = [
  slackActionHandler,
  ActionHandlerFixture({type: ActionType.EMAIL}),
  ActionHandlerFixture({
    type: ActionType.PAGERDUTY,
    integrations: [
      {
        id: 'integration-1',
        name: 'My PagerDuty',
        services: [{id: 'service-1', name: 'Service 1'}],
      },
    ],
  }),
  ActionHandlerFixture({
    type: ActionType.SENTRY_APP,
    handlerGroup: ActionGroup.OTHER,
    sentryApp: {
      id: 'id',
      installationId: 'installation-id',
      installationUuid: 'installation-uuid',
      name: 'My Sentry App',
      status: 0,
    },
  }),
  ActionHandlerFixture({
    type: ActionType.JIRA,
    handlerGroup: ActionGroup.TICKET_CREATION,
  }),
];

describe('ActionNodeList', () => {
  const organization = OrganizationFixture();

  const mockOnAddRow = jest.fn();
  const mockOnDeleteRow = jest.fn();
  const mockUpdateAction = jest.fn();

  const defaultProps = {
    actions: [],
    conditionGroupId: '0',
    onAddRow: mockOnAddRow,
    onDeleteRow: mockOnDeleteRow,
    placeholder: 'Select an action',
    updateAction: mockUpdateAction,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      body: actionHandlers,
    });
  });

  it('renders correct action options', async () => {
    render(
      <AutomationBuilderTestProvider>
        <ActionNodeList {...defaultProps} />
      </AutomationBuilderTestProvider>,
      {organization}
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Add action'}));

    expect(screen.getAllByRole('menuitemradio')).toHaveLength(5);
    expect(screen.getByRole('menuitemradio', {name: 'Slack'})).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'Notify on preferred channel'})
    ).toBeInTheDocument();

    expect(screen.getByRole('menuitemradio', {name: 'Pagerduty'})).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'My Sentry App'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Jira'})).toBeInTheDocument();
  });

  it('does not show plugin actions in the dropdown', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      body: [
        ...actionHandlers,
        ActionHandlerFixture({
          type: ActionType.PLUGIN,
          handlerGroup: ActionGroup.OTHER,
          integrations: undefined,
        }),
      ],
    });

    render(
      <AutomationBuilderTestProvider>
        <ActionNodeList {...defaultProps} />
      </AutomationBuilderTestProvider>,
      {organization}
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Add action'}));

    expect(screen.getAllByRole('menuitemradio')).toHaveLength(5);
    expect(
      screen.queryByRole('menuitemradio', {name: 'Legacy integrations'})
    ).not.toBeInTheDocument();
  });

  it('adds actions', async () => {
    render(
      <AutomationBuilderTestProvider>
        <ActionNodeList {...defaultProps} />
      </AutomationBuilderTestProvider>,
      {organization}
    );
    await userEvent.click(screen.getByRole('textbox', {name: 'Add action'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Slack'}));

    expect(mockOnAddRow).toHaveBeenCalledWith(slackActionHandler);
  });

  it('updates existing actions', async () => {
    const slackAction = ActionFixture();
    render(
      <AutomationBuilderTestProvider>
        <ActionNodeList {...defaultProps} actions={[slackAction]} />
      </AutomationBuilderTestProvider>,
      {organization}
    );

    await screen.findByText(textWithMarkupMatcher('Slack message'));
    await userEvent.type(screen.getByRole('textbox', {name: 'Tags'}), 's');
    expect(mockUpdateAction).toHaveBeenCalledWith(slackAction.id, {
      data: {tags: 's'},
    });
  });

  it('deletes existing actions', async () => {
    const slackAction = ActionFixture();
    render(
      <AutomationBuilderTestProvider>
        <ActionNodeList {...defaultProps} actions={[slackAction]} />
      </AutomationBuilderTestProvider>,
      {organization}
    );

    await screen.findByText(textWithMarkupMatcher('Slack message'));
    await userEvent.click(screen.getByRole('button', {name: 'Delete row'}));
    expect(mockOnDeleteRow).toHaveBeenCalledWith(slackAction.id);
  });

  it('shows an error for actions with unavailable handlers', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      body: [], // No available actions
    });

    const slackAction = ActionFixture();
    render(
      <AutomationBuilderTestProvider>
        <ActionNodeList {...defaultProps} actions={[slackAction]} />
      </AutomationBuilderTestProvider>,
      {organization}
    );

    expect(
      await screen.findByText(
        'This action is no longer available. Remove it to save changes.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete row'})).toBeInTheDocument();
  });

  it('flags actions the plan does not include', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/available-actions/`,
      body: [ActionHandlerFixture({disabledReason: 'plan'})],
    });

    const slackAction = ActionFixture();
    render(
      <AutomationBuilderTestProvider>
        <ActionNodeList {...defaultProps} actions={[slackAction]} />
      </AutomationBuilderTestProvider>,
      {organization}
    );

    expect(
      await screen.findByText(
        'This action is no longer available. Remove it to save changes.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete row'})).toBeInTheDocument();
  });

  it('shows warnings for incompatible actions', async () => {
    const model = new FormModel();
    model.setInitialData({
      detectorIds: ['123'],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [MetricDetectorFixture({id: '123'})],
    });
    const jiraAction = ActionFixture({type: ActionType.JIRA});
    render(
      <AutomationBuilderTestProvider
        builderState={{
          triggers: {
            id: 'triggers',
            conditions: [
              {
                id: 'condition-1',
                type: DataConditionType.SEER_ACTIVITY_TRIGGER,
                comparison: ['pr_ready_for_review'],
                conditionResult: true,
              },
            ],
            logicType: DataConditionGroupLogicType.ANY,
          },
        }}
      >
        <AutomationFormProvider>
          <Form model={model}>
            <ActionNodeList {...defaultProps} actions={[jiraAction]} />
          </Form>
        </AutomationFormProvider>
      </AutomationBuilderTestProvider>,
      {organization}
    );

    expect(
      await screen.findByText(
        'This action is incompatible with the current configuration.'
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    expect(
      screen.getByText('This action is not supported for Seer activity triggers.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('This action will not fire for metric issues.')
    ).toBeInTheDocument();
  });

  it('shows a note when another trigger can still fire the action', async () => {
    const jiraAction = ActionFixture({type: ActionType.JIRA});
    render(
      <AutomationBuilderTestProvider
        builderState={{
          triggers: triggerGroup([
            DataConditionType.FIRST_SEEN_EVENT,
            DataConditionType.ISSUE_RESOLVED_TRIGGER,
          ]),
        }}
      >
        <AutomationFormProvider>
          <Form model={new FormModel()}>
            <ActionNodeList {...defaultProps} actions={[jiraAction]} />
          </Form>
        </AutomationFormProvider>
      </AutomationBuilderTestProvider>,
      {organization}
    );

    expect(await screen.findByText(PARTIAL_SUPPORT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(INCOMPATIBLE_MESSAGE)).not.toBeInTheDocument();
  });

  it('warns when the resolved trigger is the only trigger', async () => {
    const jiraAction = ActionFixture({type: ActionType.JIRA});
    render(
      <AutomationBuilderTestProvider
        builderState={{
          triggers: triggerGroup([DataConditionType.ISSUE_RESOLVED_TRIGGER]),
        }}
      >
        <AutomationFormProvider>
          <Form model={new FormModel()}>
            <ActionNodeList {...defaultProps} actions={[jiraAction]} />
          </Form>
        </AutomationFormProvider>
      </AutomationBuilderTestProvider>,
      {organization}
    );

    expect(await screen.findByText(INCOMPATIBLE_MESSAGE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    expect(screen.getByText(RESOLVED_WARNING)).toBeInTheDocument();
    expect(screen.queryByText(PARTIAL_SUPPORT_MESSAGE)).not.toBeInTheDocument();
  });

  it('warns when all logic requires the resolved trigger', async () => {
    const jiraAction = ActionFixture({type: ActionType.JIRA});
    render(
      <AutomationBuilderTestProvider
        builderState={{
          triggers: triggerGroup(
            [DataConditionType.EVERY_EVENT, DataConditionType.ISSUE_RESOLVED_TRIGGER],
            DataConditionGroupLogicType.ALL
          ),
        }}
      >
        <AutomationFormProvider>
          <Form model={new FormModel()}>
            <ActionNodeList {...defaultProps} actions={[jiraAction]} />
          </Form>
        </AutomationFormProvider>
      </AutomationBuilderTestProvider>,
      {organization}
    );

    expect(await screen.findByText(INCOMPATIBLE_MESSAGE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    expect(screen.getByText(RESOLVED_WARNING)).toBeInTheDocument();
    expect(screen.queryByText(PARTIAL_SUPPORT_MESSAGE)).not.toBeInTheDocument();
  });

  it('keeps the metric warning next to the note', async () => {
    const model = new FormModel();
    model.setInitialData({
      detectorIds: ['123'],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/`,
      body: [MetricDetectorFixture({id: '123'})],
    });
    const jiraAction = ActionFixture({type: ActionType.JIRA});
    render(
      <AutomationBuilderTestProvider
        builderState={{
          triggers: triggerGroup([
            DataConditionType.FIRST_SEEN_EVENT,
            DataConditionType.ISSUE_RESOLVED_TRIGGER,
          ]),
        }}
      >
        <AutomationFormProvider>
          <Form model={model}>
            <ActionNodeList {...defaultProps} actions={[jiraAction]} />
          </Form>
        </AutomationFormProvider>
      </AutomationBuilderTestProvider>,
      {organization}
    );

    expect(await screen.findByText(INCOMPATIBLE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(PARTIAL_SUPPORT_MESSAGE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand'}));
    expect(
      screen.getByText('This action will not fire for metric issues.')
    ).toBeInTheDocument();
    expect(screen.queryByText(RESOLVED_WARNING)).not.toBeInTheDocument();
  });

  it('does not flag actions that fire when an issue is resolved', async () => {
    const slackAction = ActionFixture();
    render(
      <AutomationBuilderTestProvider
        builderState={{
          triggers: triggerGroup([
            DataConditionType.FIRST_SEEN_EVENT,
            DataConditionType.ISSUE_RESOLVED_TRIGGER,
          ]),
        }}
      >
        <ActionNodeList {...defaultProps} actions={[slackAction]} />
      </AutomationBuilderTestProvider>,
      {organization}
    );

    await screen.findByText(textWithMarkupMatcher('Slack message'));
    expect(screen.queryByText(INCOMPATIBLE_MESSAGE)).not.toBeInTheDocument();
    expect(screen.queryByText(PARTIAL_SUPPORT_MESSAGE)).not.toBeInTheDocument();
  });
});
