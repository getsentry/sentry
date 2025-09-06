import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {t, tct} from 'sentry/locale';
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
    handler.services?.find(s => s.slug === action.config.targetIdentifier)?.name ||
    action.config.targetIdentifier;

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
      name={`${actionId}.config.targetIdentifier`}
      aria-label={t('Webhook')}
      value={action.config.targetIdentifier}
      options={services?.map(service => ({
        label: service.name,
        value: service.slug,
      }))}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          config: {
            ...action.config,
            targetIdentifier: option.value,
          },
        });
      }}
    />
  );
}

export function validateWebhookAction(action: Action): string | undefined {
  if (!action.config.targetIdentifier) {
    return t('You must specify an integration.');
  }
  return undefined;
}
