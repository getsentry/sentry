import {
  ActionFilterFixture,
  ActionFixture,
  AutomationFixture,
} from 'sentry-fixture/automations';
import {ActionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {Action} from 'sentry/types/workflowEngine/actions';
import {ActionGroup, ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import {ActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {TicketActionSettingsButton} from 'sentry/views/automations/components/actions/ticketActionSettingsButton';
import {AutomationFormProvider} from 'sentry/views/automations/components/forms/context';

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

  renderGlobalModal();

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

/**
 * Mock the integration config API to return string fields for the given field
 * names. When the modal opens, instance values for these fields will be set as
 * the form input defaults, so we can assert on them.
 */
function mockIntegrationConfig(integrationId: string, fieldNames: string[] = []) {
  return MockApiClient.addMockResponse({
    url: `/organizations/org-slug/integrations/${integrationId}/`,
    body: {
      createIssueConfig: fieldNames.map(name => ({
        name,
        label: name,
        type: 'string',
      })),
    },
  });
}

describe('TicketActionSettingsButton', () => {
  it('uses additional_fields and dynamic_form_fields from ticketAction.data', async () => {
    mockIntegrationConfig('int-1', ['project', 'issuetype']);

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

    await userEvent.click(screen.getByRole('button', {name: 'Action Settings'}));

    // Modal opens and form fields render with instance values as defaults
    expect(await screen.findByRole('textbox', {name: 'project'})).toHaveValue('10000');
    expect(screen.getByRole('textbox', {name: 'issuetype'})).toHaveValue('10001');
  });

  it('falls back to savedActionData with camelCase keys from API response', async () => {
    mockIntegrationConfig('int-1', ['project', 'reporter']);

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

    await userEvent.click(screen.getByRole('button', {name: 'Action Settings'}));

    expect(await screen.findByRole('textbox', {name: 'project'})).toHaveValue('CAMEL');
    expect(screen.getByRole('textbox', {name: 'reporter'})).toHaveValue('me');
  });

  it('falls back to savedActionData with snake_case keys from frontend write', async () => {
    mockIntegrationConfig('int-1', ['project', 'reporter']);

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

    await userEvent.click(screen.getByRole('button', {name: 'Action Settings'}));

    expect(await screen.findByRole('textbox', {name: 'project'})).toHaveValue('SNAKE');
    expect(screen.getByRole('textbox', {name: 'reporter'})).toHaveValue('them');
  });

  it('uses savedActionData dynamic_form_fields when ticketAction has empty array', async () => {
    mockIntegrationConfig('int-1', ['project']);

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

    await userEvent.click(screen.getByRole('button', {name: 'Action Settings'}));

    expect(await screen.findByRole('textbox', {name: 'project'})).toHaveValue('DIRECT');
  });
});
