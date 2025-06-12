import AutomationBuilderInputField from 'sentry/components/workflowEngine/form/automationBuilderInputField';
import {t} from 'sentry/locale';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';

export function TargetDisplayField({placeholder}: {placeholder?: string}) {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderInputField
      name={`${actionId}.config.target_display`}
      placeholder={placeholder ? placeholder : t('channel name or ID')}
      value={action.config.target_display}
      onChange={(value: string) => {
        onUpdate({
          config: {target_display: value},
        });
      }}
    />
  );
}
