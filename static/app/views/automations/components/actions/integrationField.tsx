import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import type {SelectValue} from 'sentry/types/core';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function IntegrationField() {
  const {action, actionId, onUpdate, handler} = useActionNodeContext();
  const integrations = handler?.integrations;

  return (
    <AutomationBuilderSelect
      name={`${actionId}.integrationId`}
      value={action.integrationId}
      options={integrations?.map(team => ({
        label: team.name,
        value: team.id,
      }))}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          integrationId: option.value,
        });
      }}
    />
  );
}
