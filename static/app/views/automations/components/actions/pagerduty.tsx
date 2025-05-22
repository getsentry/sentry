import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {tct} from 'sentry/locale';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {ServiceField} from 'sentry/views/automations/components/actions/serviceField';

const PAGERDUTY_SEVERITIES = ['default', 'critical', 'warning', 'error', 'info'];

export function PagerdutyNode() {
  return tct(
    'Send a [logo] PagerDuty notification to [account] and service [service] with [severity] severity',
    {
      logo: ActionMetadata[ActionType.PAGERDUTY]?.icon,
      account: <IntegrationField />,
      service: <ServiceField />,
      severity: <SeverityField />,
    }
  );
}

function SeverityField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderSelectField
      name={`${actionId}.data.severity`}
      value={action.data.severity}
      options={PAGERDUTY_SEVERITIES.map(severity => ({
        label: severity,
        value: severity,
      }))}
      onChange={(value: string) => {
        onUpdate({
          severity: value,
        });
      }}
    />
  );
}
