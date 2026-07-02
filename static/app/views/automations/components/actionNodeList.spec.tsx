import {ActionFixture} from 'sentry-fixture/automations';
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
} from 'sentry/types/workflowEngine/dataConditions';
import {ActionNodeList} from 'sentry/views/automations/components/actionNodeList';
import {AutomationFormProvider} from 'sentry/views/automations/components/forms/context';
import {AutomationBuilderTestProvider} from 'sentry/views/automations/components/testUtils';

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
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});

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
        'The Slack action is no longer available. Please remove and reconfigure this action.'
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
                comparison: ['rca_started'],
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
});
