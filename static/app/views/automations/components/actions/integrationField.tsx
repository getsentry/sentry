import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function IntegrationField() {
  const {action, actionId, onUpdate, handler} = useActionNodeContext();
  const integrations = handler?.integrations;

  return (
    <AutomationBuilderSelect
      name={`${actionId}.integrationId`}
      aria-label={t('Integration')}
      value={action.integrationId}
      options={integrations?.map(team => ({
        label: team.name,
        value: team.id,
      }))}
      onChange={(option: SelectValue<string>) => {
        const integration = handler.integrations?.find(i => i.id === option.value);
        const defaultService = integration?.services?.[0]?.id;
        onUpdate({
          integrationId: option.value,
          ...(defaultService && {
            config: {...action.config, target_identifier: defaultService},
          }),
        });
      }}
    />
  );
}
