import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function ServiceField() {
  const {action, actionId, onUpdate, integrations} = useActionNodeContext();
  const integrationId = action.integrationId;
  const integration = integrations?.find(i => i.id === integrationId);

  if (!integration || !integrationId) {
    return null;
  }

  return (
    <AutomationBuilderSelectField
      name={`${actionId}.data.targetId`}
      value={action.data.targetId}
      options={integration.services?.map(service => ({
        label: service.name,
        value: service.id,
      }))}
      onChange={(value: string) => {
        onUpdate({
          targetId: value,
        });
      }}
    />
  );
}
