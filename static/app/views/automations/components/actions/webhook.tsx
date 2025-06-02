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
      name={`${actionId}.data.target_identifier`}
      value={action.data.target_identifier}
      options={services?.map(service => ({
        label: service.name,
        value: service.slug,
      }))}
      onChange={(value: string) => {
        onUpdate({
          config: {
            targetIdentifier: value,
          },
        });
      }}
    />
  );
}
