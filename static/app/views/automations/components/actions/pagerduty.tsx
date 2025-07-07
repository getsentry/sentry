import {AutomationBuilderSelect} from 'sentry/components/workflowEngine/form/automationBuilderSelect';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {t, tct} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {ServiceField} from 'sentry/views/automations/components/actions/serviceField';

const PAGERDUTY_SEVERITIES = ['default', 'critical', 'warning', 'error', 'info'];

export function PagerdutyDetails({
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
    'Send a [logo] PagerDuty notification to [account] and service [service] with [severity] severity',
    {
      logo: ActionMetadata[ActionType.PAGERDUTY]?.icon,
      account: integration?.name || action.integrationId,
      service: service?.name || action.config.target_identifier,
      severity: String(action.data.priority),
    }
  );
}

export function PagerdutyNode() {
  return tct(
    'Send a [logo] PagerDuty notification to [account] and service [service] with [severity] severity',
    {
      logo: ActionMetadata[ActionType.PAGERDUTY]?.icon,
      account: <IntegrationField />,
      service: <ServiceField aria-label={t('Service')} />,
      severity: <SeverityField />,
    }
  );
}

function SeverityField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderSelect
      name={`${actionId}.data.priority`}
      aria-label={t('Severity')}
      value={action.data.priority}
      options={PAGERDUTY_SEVERITIES.map(severity => ({
        label: severity,
        value: severity,
      }))}
      onChange={(option: SelectValue<string>) => {
        onUpdate({
          data: {priority: option.value},
        });
      }}
    />
  );
}
