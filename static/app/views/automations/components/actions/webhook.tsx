import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {tct} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function WebhookNode() {
  return tct('Send a notification via [services]', {
    services: <ServicesField />,
  });
}

function ServicesField() {
  const {action, actionId, onUpdate, handler} = useActionNodeContext();
  const services = handler?.services;

  return (
    <AutomationBuilderSelectField
      name={`${actionId}.data.targetIdentifier`}
      value={action.data.targetIdentifier}
      options={services?.map(service => ({
        label: service.name,
        value: service.slug,
      }))}
      onChange={(value: string) => {
        onUpdate({
          targetIdentifier: value,
        });
      }}
    />
  );
}
