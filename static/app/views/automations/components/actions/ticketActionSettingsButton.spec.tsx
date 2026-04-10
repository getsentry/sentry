import {
  ActionFilterFixture,
  ActionFixture,
  AutomationFixture,
} from 'sentry-fixture/automations';
import {ActionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import type {Action} from 'sentry/types/workflowEngine/actions';
import {ActionGroup, ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {ActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {TicketActionSettingsButton} from 'sentry/views/automations/components/actions/ticketActionSettingsButton';
import {AutomationFormProvider} from 'sentry/views/automations/components/forms/context';

jest.mock('sentry/actionCreators/modal');

function renderComponent({
  action,
  automation,
}: {
  action: Action;
  automation?: Automation;
}) {
  const handler = ActionHandlerFixture({
    type: ActionType.JIRA,
    handlerGroup: ActionGroup.TICKET_CREATION,
  });

  render(
    <AutomationFormProvider automation={automation}>
      <ActionNodeContext.Provider
        value={{
          action,
          actionId: `actionFilters.0.action.${action.id}`,
          handler,
          onUpdate: jest.fn(),
        }}
      >
        <TicketActionSettingsButton />
      </ActionNodeContext.Provider>
    </AutomationFormProvider>
  );
}

async function getModalInstance() {
  await userEvent.click(screen.getByRole('button', {name: 'Action Settings'}));
  const renderer = (openModal as jest.Mock).mock.calls[0][0];
  const modalElement = renderer({closeModal: jest.fn()});
  return modalElement.props.instance;
}

describe('TicketActionSettingsButton', () => {
  beforeEach(() => {
    (openModal as jest.Mock).mockClear();
  });

  it('uses additional_fields and dynamic_form_fields from ticketAction.data', async () => {
    const action = ActionFixture({
      id: '42',
      type: ActionType.JIRA,
      integrationId: 'int-1',
      data: {
        additional_fields: {project: '10000', issuetype: '10001'},
        dynamic_form_fields: [{name: 'priority', label: 'Priority', type: 'select'}],
      },
    });

    renderComponent({action});

    const instance = await getModalInstance();
    expect(instance).toEqual(
      expect.objectContaining({
        project: '10000',
        issuetype: '10001',
        integration: 'int-1',
        dynamic_form_fields: [{name: 'priority', label: 'Priority', type: 'select'}],
      })
    );
  });

  it('falls back to savedActionData with camelCase keys from API response', async () => {
    const action = ActionFixture({
      id: '42',
      type: ActionType.JIRA,
      integrationId: 'int-1',
      data: {},
    });

    const automation = AutomationFixture({
      actionFilters: [
        ActionFilterFixture({
          actions: [
            ActionFixture({
              id: '42',
              data: {
                additionalFields: {project: 'CAMEL', reporter: 'me'},
                dynamicFormFields: [{name: 'camelField', label: 'Camel', type: 'text'}],
              },
            }),
          ],
        }),
      ],
    });

    renderComponent({action, automation});

    const instance = await getModalInstance();
    expect(instance).toEqual(
      expect.objectContaining({
        project: 'CAMEL',
        reporter: 'me',
        integration: 'int-1',
        dynamic_form_fields: [{name: 'camelField', label: 'Camel', type: 'text'}],
      })
    );
  });

  it('falls back to savedActionData with snake_case keys from frontend write', async () => {
    const action = ActionFixture({
      id: '42',
      type: ActionType.JIRA,
      integrationId: 'int-1',
      data: {},
    });

    const automation = AutomationFixture({
      actionFilters: [
        ActionFilterFixture({
          actions: [
            ActionFixture({
              id: '42',
              data: {
                additional_fields: {project: 'SNAKE', reporter: 'them'},
                dynamic_form_fields: [{name: 'snakeField', label: 'Snake', type: 'text'}],
              },
            }),
          ],
        }),
      ],
    });

    renderComponent({action, automation});

    const instance = await getModalInstance();
    expect(instance).toEqual(
      expect.objectContaining({
        project: 'SNAKE',
        reporter: 'them',
        integration: 'int-1',
        dynamic_form_fields: [{name: 'snakeField', label: 'Snake', type: 'text'}],
      })
    );
  });

  it('uses savedActionData dynamic_form_fields when ticketAction has empty array', async () => {
    const action = ActionFixture({
      id: '42',
      type: ActionType.JIRA,
      integrationId: 'int-1',
      data: {
        additional_fields: {project: 'DIRECT'},
        dynamic_form_fields: [],
      },
    });

    const automation = AutomationFixture({
      actionFilters: [
        ActionFilterFixture({
          actions: [
            ActionFixture({
              id: '42',
              data: {
                dynamicFormFields: [
                  {name: 'fromSaved', label: 'From Saved', type: 'select'},
                ],
              },
            }),
          ],
        }),
      ],
    });

    renderComponent({action, automation});

    const instance = await getModalInstance();
    expect(instance).toEqual(
      expect.objectContaining({
        project: 'DIRECT',
        integration: 'int-1',
        dynamic_form_fields: [{name: 'fromSaved', label: 'From Saved', type: 'select'}],
      })
    );
  });
});
