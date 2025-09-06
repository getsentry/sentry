import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t} from 'sentry/locale';
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
      name={`${actionId}.config.targetIdentifier`}
      aria-label={t('Service')}
      value={action.config.targetIdentifier}
      options={integration.services?.map(service => ({
        label: service.name,
        value: service.id,
      }))}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          config: {...action.config, targetIdentifier: option.value},
        });
      }}
    />
  );
}
