import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function WebhookDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const service =
    handler.services?.find(s => s.slug === action.config.target_identifier)?.name ||
    action.config.target_identifier;

  return tct('Send a notification via [service]', {
    service: String(service),
  });
}

export function WebhookNode() {
  return tct('Send a notification via [services]', {
    services: <ServicesField />,
  });
}

function ServicesField() {
  const {action, actionId, onUpdate, handler} = useActionNodeContext();
  const services = handler?.services;

  return (
    <AutomationBuilderSelect
      name={`${actionId}.config.target_identifier`}
      value={action.config.target_identifier}
      options={services?.map(service => ({
        label: service.name,
        value: service.slug,
      }))}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          config: {
            target_identifier: option.value,
          },
        });
      }}
    />
  );
}
