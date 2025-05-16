import AutomationBuilderSelectField from 'sentry/components/workflowEngine/form/automationBuilderSelectField';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {tct} from 'sentry/locale';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {ServiceField} from 'sentry/views/automations/components/actions/serviceField';

const OPSGENIE_PRIORITIES = ['P1', 'P2', 'P3', 'P4', 'P5'];

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
    <AutomationBuilderSelectField
      name={`${actionId}.data.priority`}
      value={action.data.priority}
      options={OPSGENIE_PRIORITIES.map(priority => ({
        label: priority,
        value: priority,
      }))}
      onChange={(value: string) => {
        onUpdate({
          priority: value,
        });
      }}
    />
  );
}
