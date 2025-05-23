import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function IntegrationField() {
  const {action, actionId, onUpdate, handler} = useActionNodeContext();
  const integrations = handler?.integrations;

  return (
    <AutomationBuilderSelectField
      name={`${actionId}.integrationId`}
      value={action.integrationId}
      options={integrations?.map(team => ({
        label: team.name,
        value: team.id,
      }))}
      onChange={(value: string) => {
        onUpdate({
          integrationId: value,
        });
      }}
    />
  );
}
