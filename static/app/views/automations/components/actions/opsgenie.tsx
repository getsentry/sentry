import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {ServiceField} from 'sentry/views/automations/components/actions/serviceField';

const OPSGENIE_PRIORITIES = ['P1', 'P2', 'P3', 'P4', 'P5'];

export function OpsgenieDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const integration = handler.integrations?.find(i => i.id === action.integrationId);
  const service = integration?.services?.find(
    s => s.id === action.config.target_identifier
  );

  return tct(
    'Send a [logo] Opsgenie notification to [account] and team [team] with [priority] priority',
    {
      logo: ActionMetadata[ActionType.OPSGENIE]?.icon,
      account: integration?.name || action.integrationId,
      team: service?.name || action.config.target_identifier,
      priority: String(action.data.priority),
    }
  );
}

export function OpsgenieNode() {
  return tct(
    'Send a [logo] Opsgenie notification to [account] and team [team] with [priority] priority',
    {
      logo: ActionMetadata[ActionType.OPSGENIE]?.icon,
      account: <IntegrationField />,
      team: <ServiceField />,
      priority: <PriorityField />,
    }
  );
}

function PriorityField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${actionId}.data.priority`}
      aria-label={t('Priority')}
      value={action.data.priority}
      options={OPSGENIE_PRIORITIES.map(priority => ({
        label: priority,
        value: priority,
      }))}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          data: {priority: option.value},
        });
      }}
    />
  );
}

export function validateOpsgenieAction(action: Action): string | undefined {
  if (!action.integrationId) {
    return t('You must specify an Opsgenie configuration.');
  }
  if (!action.config.target_identifier) {
    return t('You must specify a team.');
  }
  if (!action.data.priority) {
    return t('You must specify a priority.');
  }
  return undefined;
}
