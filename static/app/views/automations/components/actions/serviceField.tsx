import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import type {SelectValue} from 'sentry/types/core';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function ServiceField() {
  const {action, actionId, onUpdate, handler} = useActionNodeContext();
  const integrationId = action.integrationId;
  const integration = handler.integrations?.find(i => i.id === integrationId);

  if (!integration || !integrationId) {
    return null;
  }

  return (
    <AutomationBuilderSelect
      name={`${actionId}.config.target_identifier`}
      value={action.config.target_identifier}
      options={integration.services?.map(service => ({
        label: service.name,
        value: service.id,
      }))}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          config: {target_identifier: option.value},
        });
      }}
    />
  );
}
