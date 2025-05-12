import AutomationBuilderInputField from 'sentry/components/workflowEngine/form/automationBuilderInputField';
import {t} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function TargetDisplayField({placeholder}: {placeholder?: string}) {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderInputField
      name={`${actionId}.data.targetDisplay`}
      placeholder={placeholder ? placeholder : t('channel, name, or ID')}
      value={action.data.targetDisplay}
      onChange={(value: string) => {
        onUpdate({
          targetDisplay: value,
        });
      }}
    />
  );
}
